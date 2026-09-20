import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import axios from 'axios';

export interface YouTubeChannelInfo {
  channelId: string;
  name: string;
  thumbnailUrl?: string;
  subscriberCount?: string;
}

export interface UploadVideoOptions {
  channelId: string; // The database YoutubeChannel id
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refresh and return a valid access token for the given YouTube channel.
   * Updates cached token and expiry in database.
   */
  async getValidAccessToken(channelRecord: any): Promise<string> {
    const now = new Date();
    // If token exists and has > 5 minutes of validity left, use it
    if (channelRecord.accessToken && channelRecord.tokenExpiry && new Date(channelRecord.tokenExpiry) > new Date(now.getTime() + 5 * 60 * 1000)) {
      return channelRecord.accessToken;
    }

    const clientId = channelRecord.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = channelRecord.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!channelRecord.refreshToken) {
      throw new Error(`YouTube Channel "${channelRecord.name}" is missing a refresh token. Please reconnect.`);
    }

    if (!clientId || !clientSecret) {
      throw new Error(`Google Client ID or Client Secret not configured for YouTube Channel "${channelRecord.name}".`);
    }

    this.logger.log(`Refreshing Google OAuth token for channel: ${channelRecord.name}`);
    try {
      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: channelRecord.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        },
      );

      const { access_token, expires_in } = response.data;
      const expiryDate = new Date(Date.now() + (expires_in || 3600) * 1000);

      await this.prisma.youtubeChannel.update({
        where: { id: channelRecord.id },
        data: {
          accessToken: access_token,
          tokenExpiry: expiryDate,
        },
      });

      this.logger.log(`Google OAuth token refreshed successfully for channel: ${channelRecord.name}`);
      return access_token;
    } catch (err: any) {
      const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`Failed to refresh token for channel ${channelRecord.name}: ${errorDetails}`);
      throw new Error(`Failed to refresh YouTube session token: ${errorDetails}`);
    }
  }

  /**
   * Verify credentials and fetch YouTube channel info (Title, ID, Avatar, Stats)
   */
  async fetchChannelInfoWithToken(accessToken: string): Promise<YouTubeChannelInfo> {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'snippet,statistics',
          mine: 'true',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });

      const items = response.data?.items;
      if (!items || items.length === 0) {
        throw new Error('No YouTube channel found for the authenticated Google account.');
      }

      const channel = items[0];
      return {
        channelId: channel.id,
        name: channel.snippet?.title || 'YouTube Channel',
        thumbnailUrl: channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.medium?.url || '',
        subscriberCount: channel.statistics?.subscriberCount || '0',
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      this.logger.error(`Failed to fetch channel info: ${errorMsg}`);
      throw new Error(`YouTube API Error: ${errorMsg}`);
    }
  }

  /**
   * Exchange an authorization code for tokens, fetch channel, and save/update record.
   */
  async exchangeAuthCode(code: string, redirectUri: string, clientId?: string, clientSecret?: string, userId?: string) {
    const cid = clientId || process.env.GOOGLE_CLIENT_ID;
    const csecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!cid || !csecret) {
      throw new Error('Google OAuth Client ID & Secret must be provided.');
    }

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: cid,
        client_secret: csecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      },
    );

    const { refresh_token, access_token, expires_in } = tokenRes.data;
    if (!refresh_token) {
      throw new Error('Google did not return a refresh token. Please remove app permissions in Google Account and try again with prompt=consent.');
    }

    const channelInfo = await this.fetchChannelInfoWithToken(access_token);
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    const savedChannel = await this.prisma.youtubeChannel.upsert({
      where: { channelId: channelInfo.channelId },
      create: {
        channelId: channelInfo.channelId,
        name: channelInfo.name,
        thumbnailUrl: channelInfo.thumbnailUrl,
        refreshToken: refresh_token,
        accessToken: access_token,
        tokenExpiry,
        clientId: cid,
        clientSecret: csecret,
        userId: userId || null,
        status: 'ACTIVE',
      },
      update: {
        name: channelInfo.name,
        thumbnailUrl: channelInfo.thumbnailUrl,
        refreshToken: refresh_token,
        accessToken: access_token,
        tokenExpiry,
        clientId: cid,
        clientSecret: csecret,
        status: 'ACTIVE',
      },
    });

    return savedChannel;
  }

  /**
   * Upload video file directly to YouTube using Resumable Upload protocol.
   * Optimized for YouTube Shorts and vertical videos.
   */
  async uploadVideo(options: UploadVideoOptions): Promise<{ videoId: string; youtubeUrl: string; title: string }> {
    const { channelId, filePath, title, description, tags = [], privacyStatus = 'public' } = options;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file does not exist at path: ${filePath}`);
    }

    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`YouTube Channel not found with ID: ${channelId}`);
    }

    const accessToken = await this.getValidAccessToken(channel);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Ensure title does not exceed 100 characters (YouTube limit) while keeping hashtags
    let cleanTitle = title.trim();
    if (cleanTitle.length > 100) {
      // Truncate cleanly
      cleanTitle = cleanTitle.substring(0, 97).trim() + '...';
    }

    this.logger.log(`Initiating YouTube Resumable Upload for channel "${channel.name}". File size: ${fileSize} bytes. Title: "${cleanTitle}"`);

    // 1. Initiate Resumable Upload Session
    const metadata = {
      snippet: {
        title: cleanTitle,
        description: description || cleanTitle,
        tags: tags.length > 0 ? tags : ['Shorts', 'TikTok', 'Trending'],
        categoryId: '22', // People & Blogs (Default standard)
      },
      status: {
        privacyStatus: privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    let uploadUrl: string;
    try {
      const initRes = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        metadata,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': fileSize.toString(),
            'X-Upload-Content-Type': 'video/mp4',
          },
          timeout: 30000,
        },
      );

      uploadUrl = initRes.headers['location'] || initRes.headers['Location'];
      if (!uploadUrl) {
        throw new Error('YouTube did not return a resumable upload location URL.');
      }
    } catch (err: any) {
      const errorBody = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`YouTube upload initiation failed: ${errorBody}`);
      throw new Error(`YouTube API Initiation Error: ${errorBody}`);
    }

    this.logger.log(`Resumable session obtained. Streaming video binary to YouTube...`);

    // 2. Stream video file directly to the upload URL
    try {
      const fileStream = fs.createReadStream(filePath);
      const uploadRes = await axios.put(uploadUrl, fileStream, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': fileSize.toString(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 10 * 60 * 1000, // 10 minutes timeout for large files
      });

      const uploadedVideo = uploadRes.data;
      const videoId = uploadedVideo.id;
      const youtubeUrl = `https://www.youtube.com/shorts/${videoId}`;

      this.logger.log(`Video uploaded successfully to YouTube! Video ID: ${videoId}, URL: ${youtubeUrl}`);
      return {
        videoId,
        youtubeUrl,
        title: cleanTitle,
      };
    } catch (err: any) {
      const errorBody = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`YouTube binary upload failed: ${errorBody}`);
      throw new Error(`YouTube API Binary Upload Error: ${errorBody}`);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly graphApiVersion = 'v19.0';
  private readonly graphApiBase = `https://graph.facebook.com/${this.graphApiVersion}`;

  /**
   * Initialize a resumable video upload session.
   * @param pageId The Facebook Page ID
   * @param accessToken The Page Access Token
   * @param fileSize The total size of the video file in bytes
   * @returns The video ID and upload session ID
   */
  async initializeUpload(pageId: string, accessToken: string, fileSize: number): Promise<{ videoId: string; uploadSessionId: string }> {
    this.logger.log(`Initializing upload for Page ID: ${pageId}, Size: ${fileSize}`);
    
    const url = `${this.graphApiBase}/${pageId}/videos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        upload_phase: 'start',
        file_size: fileSize,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      this.logger.error(`Error initializing upload: ${JSON.stringify(data.error)}`);
      throw new Error(data.error?.message || 'Failed to initialize video upload');
    }

    return {
      videoId: data.video_id,
      uploadSessionId: data.upload_session_id,
    };
  }

  /**
   * Upload a chunk of the video file.
   * @param pageId The Facebook Page ID
   * @param accessToken The Page Access Token
   * @param uploadSessionId The upload session ID obtained from initialization
   * @param startOffset The start offset in bytes
   * @param chunk The video chunk buffer
   */
  async uploadChunk(
    pageId: string, 
    accessToken: string, 
    uploadSessionId: string, 
    startOffset: number, 
    chunk: Buffer
  ): Promise<any> {
    const url = `${this.graphApiBase}/${pageId}/videos`;
    
    // Facebook requires multipart/form-data for chunks
    const formData = new FormData();
    formData.append('access_token', accessToken);
    formData.append('upload_phase', 'transfer');
    formData.append('upload_session_id', uploadSessionId);
    formData.append('start_offset', startOffset.toString());
    formData.append('video_file_chunk', new Blob([new Uint8Array(chunk)]), 'chunk');

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      this.logger.error(`Error uploading chunk: ${JSON.stringify(data.error)}`);
      throw new Error(data.error?.message || 'Failed to upload video chunk');
    }

    return data;
  }

  /**
   * Finish the resumable upload session and publish the video.
   * @param pageId The Facebook Page ID
   * @param accessToken The Page Access Token
   * @param uploadSessionId The upload session ID
   * @param title The video title
   * @param description The video description
   */
  async finishUpload(
    pageId: string, 
    accessToken: string, 
    uploadSessionId: string, 
    title?: string, 
    description?: string
  ): Promise<any> {
    this.logger.log(`Finishing upload session: ${uploadSessionId} for Page ID: ${pageId}`);
    
    const url = `${this.graphApiBase}/${pageId}/videos`;
    
    const payload: any = {
      access_token: accessToken,
      upload_phase: 'finish',
      upload_session_id: uploadSessionId,
    };

    if (title) payload.title = title;
    if (description) payload.description = description;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      this.logger.error(`Error finishing upload: ${JSON.stringify(data.error)}`);
      throw new Error(data.error?.message || 'Failed to finish video upload');
    }

    this.logger.log(`Successfully published video. FB Video ID: ${data.id || data.video_id || 'unknown'}`);
    return data;
  }

  /**
   * A helper method to fetch Page details to verify the access token.
   */
  async verifyPageToken(pageId: string, accessToken: string): Promise<any> {
    const url = `${this.graphApiBase}/${pageId}?access_token=${accessToken}&fields=id,name,picture,access_token`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || 'Invalid Page Access Token or Page ID');
    }
    
    return data;
  }
}

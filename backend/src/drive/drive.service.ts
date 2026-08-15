import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';

@Injectable()
export class DriveService {
  private drive: drive_v3.Drive;
  private readonly logger = new Logger(DriveService.name);

  constructor() {
    this.initializeDriveClient();
  }

  private initializeDriveClient() {
    try {
      const credentialsString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!credentialsString) {
        this.logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is missing.');
        return;
      }
      
      const credentials = JSON.parse(credentialsString);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.logger.log('Google Drive API client initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Google Drive client. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is valid JSON.', error);
    }
  }

  isConfigured(): boolean {
    return !!this.drive;
  }

  async listVideosInFolder(folderId: string, limit: number = 2): Promise<drive_v3.Schema$File[]> {
    if (!this.drive) throw new Error('Drive client not initialized');
    
    // Fetch video files
    const query = `'${folderId}' in parents and trashed = false and mimeType contains 'video/'`;
    
    try {
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, size)',
        orderBy: 'createdTime asc', // oldest first
        pageSize: limit,
      });

      return response.data.files || [];
    } catch (error) {
      this.logger.error(`Error listing files in folder ${folderId}:`, error);
      throw error;
    }
  }

  async downloadVideo(fileId: string, destinationPath: string): Promise<void> {
    if (!this.drive) throw new Error('Drive client not initialized');
    
    return new Promise(async (resolve, reject) => {
      try {
        const dest = fs.createWriteStream(destinationPath);
        const res = await this.drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );

        res.data
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          })
          .pipe(dest);
      } catch (err) {
        reject(err);
      }
    });
  }

  async moveFile(fileId: string, newFolderId: string): Promise<void> {
    if (!this.drive) throw new Error('Drive client not initialized');
    
    try {
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents',
      });
      
      const previousParents = file.data.parents?.join(',') || '';
      
      await this.drive.files.update({
        fileId: fileId,
        addParents: newFolderId,
        removeParents: previousParents,
        fields: 'id, parents',
      });
    } catch (error) {
      this.logger.error(`Error moving file ${fileId} to folder ${newFolderId}:`, error);
      throw error;
    }
  }
}

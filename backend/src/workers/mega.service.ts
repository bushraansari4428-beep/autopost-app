import { Injectable, Logger } from '@nestjs/common';
import { Storage, File } from 'megajs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MegaService {
  private readonly logger = new Logger(MegaService.name);
  private storageMap = new Map<string, Storage>();

  async getStorage(megaEmail?: string, megaPassword?: string): Promise<Storage> {
    const email = megaEmail || process.env.MEGA_EMAIL;
    const password = megaPassword || process.env.MEGA_PASSWORD;

    if (!email || !password) {
      throw new Error('MEGA credentials are not provided or set in environment variables.');
    }

    if (this.storageMap.has(email)) {
      return this.storageMap.get(email)!;
    }

    this.logger.log(`Logging into Mega.nz with ${email}...`);
    const storage = await new Storage({ 
      email, 
      password,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }).ready;
    
    this.storageMap.set(email, storage);
    this.logger.log(`Successfully connected to Mega.nz for ${email}!`);
    return storage;
  }

  async uploadFile(filename: string, buffer: Buffer, megaEmail?: string, megaPassword?: string): Promise<string> {
    const storage = await this.getStorage(megaEmail, megaPassword);
    
    // Find or create 'AutoPost_Cloud' folder
    let targetFolder = storage.root.children?.find((c: any) => c.name === 'AutoPost_Cloud');
    if (!targetFolder) {
      targetFolder = await storage.mkdir('AutoPost_Cloud');
    }

    this.logger.log(`Uploading ${filename} to Mega.nz...`);
    const file = await (targetFolder.upload(filename, buffer) as any).complete;
    
    const link = await file.link(false);
    this.logger.log(`Uploaded to Mega: ${link}`);
    return link as string;
  }

  async downloadFile(megaUrl: string): Promise<string> {
    this.logger.log(`Downloading file from Mega.nz: ${megaUrl}`);
    const file = File.fromURL(megaUrl);
    await file.loadAttributes();

    const tempPath = path.join(os.tmpdir(), `mega_${Date.now()}_${file.name}`);
    const stream = file.download({});
    const writeStream = fs.createWriteStream(tempPath);

    return new Promise((resolve, reject) => {
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        reject(new Error('Mega download timed out after 5 minutes.'));
      }, 5 * 60 * 1000);

      stream.pipe(writeStream);
      
      stream.on('end', () => {
        clearTimeout(timeout);
        this.logger.log(`Download stream ended: ${tempPath}`);
        resolve(tempPath);
      });
      
      writeStream.on('finish', () => {
        clearTimeout(timeout);
        this.logger.log(`File write finished: ${tempPath}`);
        resolve(tempPath);
      });

      stream.on('error', (err: any) => {
        clearTimeout(timeout);
        this.logger.error(`Mega download error: ${err.message}`);
        reject(err);
      });
      
      writeStream.on('error', (err: any) => {
        clearTimeout(timeout);
        this.logger.error(`File write error: ${err.message}`);
        reject(err);
      });
    });
  }

  async deleteFile(megaUrl: string, megaEmail?: string, megaPassword?: string): Promise<boolean> {
    try {
      const storage = await this.getStorage(megaEmail, megaPassword);
      
      // We need to parse the file ID from the URL or just search all children for the link
      const targetFolder = storage.root.children?.find((c: any) => c.name === 'AutoPost_Cloud');
      if (targetFolder && targetFolder.children) {
        // Since we can't easily extract the exact file ID from a folder link,
        // we'll load the file from URL to get its ID, then find it in our storage
        const fileRef = File.fromURL(megaUrl);
        // Wait, file.nodeId is available if we load attributes, but the URL contains it
        
        // Let's just find the file whose link matches
        for (const child of targetFolder.children) {
           const link = await child.link(false);
           if (link === megaUrl) {
             this.logger.log(`Deleting file from Mega.nz: ${child.name}`);
             await child.delete();
             return true;
           }
        }
      }
      
      this.logger.warn(`File not found in Mega tree for deletion: ${megaUrl}`);
      return false;
    } catch (e) {
      this.logger.error(`Failed to delete file from Mega: ${e.message}`);
      return false;
    }
  }
}

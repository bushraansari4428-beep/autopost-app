export declare class FacebookService {
    private readonly logger;
    private readonly graphApiVersion;
    private readonly graphApiBase;
    initializeUpload(pageId: string, accessToken: string, fileSize: number): Promise<{
        videoId: string;
        uploadSessionId: string;
    }>;
    uploadChunk(pageId: string, accessToken: string, uploadSessionId: string, startOffset: number, chunk: Buffer): Promise<any>;
    finishUpload(pageId: string, accessToken: string, uploadSessionId: string, title?: string, description?: string): Promise<any>;
    verifyPageToken(pageId: string, accessToken: string): Promise<any>;
}

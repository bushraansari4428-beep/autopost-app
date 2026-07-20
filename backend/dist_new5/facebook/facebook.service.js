"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FacebookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookService = void 0;
const common_1 = require("@nestjs/common");
let FacebookService = FacebookService_1 = class FacebookService {
    logger = new common_1.Logger(FacebookService_1.name);
    graphApiVersion = 'v19.0';
    graphApiBase = `https://graph.facebook.com/${this.graphApiVersion}`;
    async initializeUpload(pageId, accessToken, fileSize) {
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
    async uploadChunk(pageId, accessToken, uploadSessionId, startOffset, chunk) {
        const url = `${this.graphApiBase}/${pageId}/videos`;
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
    async finishUpload(pageId, accessToken, uploadSessionId, title, description) {
        this.logger.log(`Finishing upload session: ${uploadSessionId} for Page ID: ${pageId}`);
        const url = `${this.graphApiBase}/${pageId}/videos`;
        const payload = {
            access_token: accessToken,
            upload_phase: 'finish',
            upload_session_id: uploadSessionId,
        };
        if (title)
            payload.title = title;
        if (description)
            payload.description = description;
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
    async verifyPageToken(pageId, accessToken) {
        const url = `${this.graphApiBase}/${pageId}?access_token=${accessToken}&fields=id,name,picture,access_token`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error?.message || 'Invalid Page Access Token or Page ID');
        }
        return data;
    }
};
exports.FacebookService = FacebookService;
exports.FacebookService = FacebookService = FacebookService_1 = __decorate([
    (0, common_1.Injectable)()
], FacebookService);
//# sourceMappingURL=facebook.service.js.map
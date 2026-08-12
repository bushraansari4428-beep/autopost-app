import { extractXiaohongshuVideo, downloadXiaohongshuVideo } from './src/workers/xiaohongshu.scraper';
import * as path from 'path';
import * as os from 'os';

async function test() {
  try {
    const targetUrl = 'http://xhslink.com/o/1tBzBcfhZ25';
    console.log('Extracting URL...');
    const xhsMeta = await extractXiaohongshuVideo(targetUrl);
    
    if (!xhsMeta) {
      console.log('Failed to extract metadata.');
      return;
    }
    
    console.log('Extracted Metadata:', xhsMeta);
    
    const videoUrl = xhsMeta.mp4Url;
    console.log(`\n\n--- THE EXACT VIDEO URL IS --- \n${videoUrl}\n-----------------------------\n`);
    
    const tempPath = path.join(os.tmpdir(), `test_upload_${Date.now()}.mp4`);
    console.log(`Downloading to ${tempPath}...`);
    
    await downloadXiaohongshuVideo(videoUrl, tempPath);
    console.log('Download SUCCESS!');
  } catch (e: any) {
    console.error('ERROR OCCURRED:', e.message);
    console.error(e.stack);
  }
}

test();

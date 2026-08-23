const { File } = require('megajs');
const fs = require('fs');

async function main() {
  console.log('Testing megajs download...');
  try {
    const file = File.fromURL('https://mega.nz/file/zzBHTTaK#xI8zWBQsivWlDuDumQFq5V53rLRSimGrq1GVDYqL-kw');
    console.log('Loading attributes...');
    await file.loadAttributes();
    console.log('Attributes loaded:', file.name);
    
    console.log('Downloading...');
    const stream = file.download({});
    const writeStream = fs.createWriteStream('test.mp4');
    
    let downloaded = 0;
    stream.on('data', (chunk) => {
       downloaded += chunk.length;
       console.log('Downloaded', downloaded);
    });
    
    stream.pipe(writeStream);
    
    stream.on('end', () => console.log('Done!'));
    stream.on('error', (e) => console.log('Error:', e.message));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();

const fs = require('fs');
const code = fs.readFileSync('lib/uploadChatMedia.ts', 'utf8');
console.log(code.includes('expo-file-system'));

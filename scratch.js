const fs = require('expo-file-system/legacy');
console.log("Types:", Object.keys(fs).filter(k => k.includes('UploadType')));
console.log("MULTIPART:", fs.FileSystemUploadType?.MULTIPART);

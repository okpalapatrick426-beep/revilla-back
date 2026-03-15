const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Image storage
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'revilla/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, quality: 'auto' }],
  },
});

// Avatar storage
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'revilla/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  },
});

// Voice/audio - stored as raw
const voiceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'revilla/voice',
    resource_type: 'video', // cloudinary uses 'video' for audio too
    allowed_formats: ['webm', 'mp3', 'ogg', 'wav', 'm4a'],
  },
});

const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadVoice = multer({ storage: voiceStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Smart uploader - detects file type
const smartStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isImage = file.mimetype.startsWith('image/');
    return {
      folder: isAudio ? 'revilla/voice' : 'revilla/images',
      resource_type: isAudio ? 'video' : 'image',
      allowed_formats: isAudio
        ? ['webm', 'mp3', 'ogg', 'wav', 'm4a']
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    };
  },
});

const uploadSmart = multer({ storage: smartStorage, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadImage, uploadAvatar, uploadVoice, uploadSmart, cloudinary };

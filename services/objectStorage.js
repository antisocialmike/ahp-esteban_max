const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand
} = require('@aws-sdk/client-s3');

let s3Client;
let bucketReadyPromise;

function getStorageBackend() {
  return process.env.S3_BUCKET ? 's3' : 'local';
}

function sanitizeFilename(value) {
  return String(value || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function getS3Client() {
  if (!s3Client) {
    const endpoint = String(process.env.S3_ENDPOINT || '').trim();
    const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle
    });
  }

  return s3Client;
}

function getPublicUrlForKey(key) {
  const baseUrl = String(process.env.S3_PUBLIC_BASE_URL || '').trim();
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}/${key}`;
  }

  const endpoint = String(process.env.S3_ENDPOINT || '').trim();
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${process.env.S3_BUCKET}/${key}`;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

async function ensureS3Bucket() {
  if (bucketReadyPromise) {
    return bucketReadyPromise;
  }

  const bucket = String(process.env.S3_BUCKET || '').trim();
  if (!bucket) {
    return;
  }

  bucketReadyPromise = (async () => {
    const client = getS3Client();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch (err) {
      const statusCode = err?.$metadata?.httpStatusCode;
      const isNotFound = err?.name === 'NotFound' || statusCode === 404;
      if (!isNotFound) {
        throw err;
      }
    }

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  })();

  return bucketReadyPromise;
}

async function saveBuffer({ buffer, contentType, folder, originalName, filenamePrefix = 'asset' }) {
  const safeFolder = String(folder || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'misc';
  const safeOriginalName = sanitizeFilename(originalName);
  const extension = path.extname(safeOriginalName) || '';
  const baseName = path.basename(safeOriginalName, extension) || filenamePrefix;
  const finalName = `${filenamePrefix}-${Date.now()}-${randomUUID()}-${baseName}${extension}`;

  if (getStorageBackend() === 's3') {
    await ensureS3Bucket();

    const key = `${safeFolder}/${finalName}`;
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream'
    }));

    return {
      backend: 's3',
      key,
      publicPath: getPublicUrlForKey(key)
    };
  }

  const localBaseDir = path.join(__dirname, '..', 'public', 'uploads', safeFolder);
  fs.mkdirSync(localBaseDir, { recursive: true });

  const filePath = path.join(localBaseDir, finalName);
  await fs.promises.writeFile(filePath, buffer);

  return {
    backend: 'local',
    key: `uploads/${safeFolder}/${finalName}`,
    publicPath: `/uploads/${safeFolder}/${finalName}`
  };
}

module.exports = {
  getStorageBackend,
  saveBuffer
};
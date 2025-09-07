/**
 * File Storage Service for File Imports
 * 
 * Handles file storage operations using Cloudflare R2.
 * Provides upload, download, and deletion operations with proper
 * organization and security.
 */

import type { R2Bucket } from '../../types/cloudflare';

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag: string;
  uploadedAt: Date;
}

export class FileStorageService {
  constructor(private r2Bucket: R2Bucket) {}

  /**
   * Upload a file to R2 storage
   */
  async uploadFile(
    orgId: string,
    fileId: string,
    fileName: string,
    fileBuffer: ArrayBuffer,
    contentType: string
  ): Promise<StoredFile> {
    // Create organized key structure: imports/{org_id}/{file_id}/{filename}
    const key = `imports/${orgId}/${fileId}/${fileName}`;
    
    const result = await this.r2Bucket.put(key, fileBuffer, {
      httpMetadata: {
        contentType: contentType,
        cacheControl: 'private, max-age=86400', // 24 hours
        contentDisposition: `attachment; filename="${fileName}"`
      },
      customMetadata: {
        orgId,
        fileId,
        originalName: fileName,
        uploadedAt: new Date().toISOString()
      }
    });

    if (!result) {
      throw new Error('Failed to upload file to R2 storage');
    }

    return {
      key: result.key,
      url: this.getFileUrl(result.key),
      size: result.size,
      contentType: result.httpMetadata?.contentType || contentType,
      etag: result.etag,
      uploadedAt: result.uploaded
    };
  }

  /**
   * Download a file from R2 storage
   */
  async downloadFile(key: string): Promise<ArrayBuffer | null> {
    const object = await this.r2Bucket.get(key);
    if (!object) {
      return null;
    }

    return await object.arrayBuffer();
  }

  /**
   * Get file metadata without downloading content
   */
  async getFileMetadata(key: string): Promise<StoredFile | null> {
    const object = await this.r2Bucket.head(key);
    if (!object) {
      return null;
    }

    return {
      key: object.key,
      url: this.getFileUrl(object.key),
      size: object.size,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      etag: object.etag,
      uploadedAt: object.uploaded
    };
  }

  /**
   * Delete a file from R2 storage
   */
  async deleteFile(key: string): Promise<void> {
    await this.r2Bucket.delete(key);
  }

  /**
   * Delete multiple files from R2 storage
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.r2Bucket.delete(keys);
  }

  /**
   * List files for an organization
   */
  async listFiles(orgId: string, prefix?: string): Promise<StoredFile[]> {
    const listPrefix = `imports/${orgId}/${prefix || ''}`;
    
    const objects = await this.r2Bucket.list({
      prefix: listPrefix,
      include: ['httpMetadata', 'customMetadata']
    });

    return objects.objects.map(obj => ({
      key: obj.key,
      url: this.getFileUrl(obj.key),
      size: obj.size,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      etag: obj.etag,
      uploadedAt: obj.uploaded
    }));
  }

  /**
   * Generate a public URL for a file (if needed for downloads)
   * For now, this returns a placeholder - in production you might
   * generate signed URLs or use a CDN
   */
  private getFileUrl(key: string): string {
    return `r2://${key}`; // Placeholder URL format
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const metadata = await this.r2Bucket.head(key);
    return metadata !== null;
  }

  /**
   * Generate a unique file key for uploads
   */
  static generateFileKey(orgId: string, fileId: string, fileName: string): string {
    return `imports/${orgId}/${fileId}/${fileName}`;
  }

  /**
   * Extract components from a file key
   */
  static parseFileKey(key: string): { orgId: string; fileId: string; fileName: string } | null {
    const match = key.match(/^imports\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (!match) return null;
    
    return {
      orgId: match[1],
      fileId: match[2],
      fileName: match[3]
    };
  }
}
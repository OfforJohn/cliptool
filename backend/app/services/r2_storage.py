import boto3
from botocore.config import Config
import os
from typing import Optional, BinaryIO
import logging

logger = logging.getLogger(__name__)


class R2Storage:
    """Cloudflare R2 Storage Service (S3-compatible)"""
    
    def __init__(self):
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "cliptool-videos")
        
        self.enabled = all([
            self.account_id,
            self.access_key_id,
            self.secret_access_key
        ])
        
        if self.enabled:
            self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
            self.client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=Config(signature_version='s3v4'),
                region_name='auto'
            )
            logger.info(f"R2 Storage enabled with bucket: {self.bucket_name}")
        else:
            self.client = None
            logger.warning("R2 Storage disabled - missing credentials. Using local storage.")
    
    def upload_file(self, file_path: str, object_key: str, content_type: str = "video/mp4") -> Optional[str]:
        """Upload a file to R2 and return the object key"""
        if not self.enabled:
            return None
        
        try:
            with open(file_path, 'rb') as f:
                self.client.upload_fileobj(
                    f,
                    self.bucket_name,
                    object_key,
                    ExtraArgs={'ContentType': content_type}
                )
            logger.info(f"Uploaded to R2: {object_key}")
            return object_key
        except Exception as e:
            logger.error(f"R2 upload failed: {e}")
            return None
    
    def upload_fileobj(self, file_obj: BinaryIO, object_key: str, content_type: str = "video/mp4") -> Optional[str]:
        """Upload a file object to R2"""
        if not self.enabled:
            return None
        
        try:
            self.client.upload_fileobj(
                file_obj,
                self.bucket_name,
                object_key,
                ExtraArgs={'ContentType': content_type}
            )
            logger.info(f"Uploaded to R2: {object_key}")
            return object_key
        except Exception as e:
            logger.error(f"R2 upload failed: {e}")
            return None
    
    def download_file(self, object_key: str, file_path: str) -> bool:
        """Download a file from R2 to local path"""
        if not self.enabled:
            return False
        
        try:
            self.client.download_file(self.bucket_name, object_key, file_path)
            logger.info(f"Downloaded from R2: {object_key}")
            return True
        except Exception as e:
            logger.error(f"R2 download failed: {e}")
            return False
    
    def get_presigned_url(self, object_key: str, expires_in: int = 3600) -> Optional[str]:
        """Get a presigned URL for direct access (valid for expires_in seconds)"""
        if not self.enabled:
            return None
        
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_key},
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None
    
    def delete_file(self, object_key: str) -> bool:
        """Delete a file from R2"""
        if not self.enabled:
            return False
        
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=object_key)
            logger.info(f"Deleted from R2: {object_key}")
            return True
        except Exception as e:
            logger.error(f"R2 delete failed: {e}")
            return False
    
    def file_exists(self, object_key: str) -> bool:
        """Check if a file exists in R2"""
        if not self.enabled:
            return False
        
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=object_key)
            return True
        except:
            return False
    
    def get_public_url(self, object_key: str) -> str:
        """Get the public URL for an object (requires public bucket or custom domain)"""
        # For R2 with custom domain or public bucket
        # Default R2 doesn't have public URLs, so we use presigned URLs
        return self.get_presigned_url(object_key, expires_in=86400) or ""

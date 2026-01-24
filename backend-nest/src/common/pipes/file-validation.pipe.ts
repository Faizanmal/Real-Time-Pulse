import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  transform(value: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    // Log metadata for debugging
    if (metadata.type) {
      // Metadata contains information about the parameter being validated
      console.log(`Validating file from ${metadata.type}: ${metadata.data || 'unknown'}`);
    }

    // Validate file size
    if (this.options.maxSize && value.size > this.options.maxSize) {
      const maxSizeMB = (this.options.maxSize / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }

    // Validate MIME type
    if (this.options.allowedMimeTypes && this.options.allowedMimeTypes.length > 0) {
      if (!this.options.allowedMimeTypes.includes(value.mimetype)) {
        throw new BadRequestException(
          `File type ${value.mimetype} is not allowed. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
        );
      }
    }

    // Validate file extension
    if (this.options.allowedExtensions && this.options.allowedExtensions.length > 0) {
      const fileExtension = value.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !this.options.allowedExtensions.includes(fileExtension)) {
        throw new BadRequestException(
          `File extension .${fileExtension} is not allowed. Allowed extensions: ${this.options.allowedExtensions.join(', ')}`,
        );
      }
    }

    return value;
  }
}

// Predefined validation pipes for common use cases
export class ImageValidationPipe extends FileValidationPipe {
  constructor() {
    super({
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    });
  }
}

export class DocumentValidationPipe extends FileValidationPipe {
  constructor() {
    super({
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
    });
  }
}

export class CSVValidationPipe extends FileValidationPipe {
  constructor() {
    super({
      maxSize: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel'],
      allowedExtensions: ['csv'],
    });
  }
}

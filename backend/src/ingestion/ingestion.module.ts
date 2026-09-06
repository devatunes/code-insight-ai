import { Module } from '@nestjs/common';
import { GitCloneService } from './git-clone.service.js';
import { ZipUploadService } from './zip-upload.service.js';

@Module({
  providers: [GitCloneService, ZipUploadService],
  exports: [GitCloneService, ZipUploadService],
})
export class IngestionModule {}

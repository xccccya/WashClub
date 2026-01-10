import { forwardRef, Module } from '@nestjs/common';
import { FileController } from './file.controller.js';
import { FileService } from './file.service.js';
import { AssetController } from './asset.controller.js';
import { AssetService } from './asset.service.js';
import { ThumbnailService } from './thumbnail.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
	imports: [forwardRef(() => AuthModule)],
	controllers: [FileController, AssetController],
	providers: [FileService, AssetService, ThumbnailService],
	exports: [FileService, AssetService, ThumbnailService], // 导出服务供其他模块使用
})
export class FileModule {}

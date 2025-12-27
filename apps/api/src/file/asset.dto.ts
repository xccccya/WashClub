import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssetDto {
	@ApiPropertyOptional({ description: '文件名（重命名）' })
	filename?: string;

	@ApiPropertyOptional({ description: '是否公开' })
	isPublic?: boolean;

	@ApiPropertyOptional({ description: '标签列表', type: [String] })
	tags?: string[];
}

export class AssetGenThumbsDto {
	@ApiPropertyOptional({ description: '缩略图尺寸列表', type: [Number], default: [120, 240, 480] })
	sizes?: number[];
}

export class AssetBulkThumbsDto {
	@ApiProperty({ description: '资产ID列表', type: [String] })
	ids!: string[];

	@ApiPropertyOptional({ description: '缩略图尺寸列表', type: [Number], default: [120, 240, 480] })
	sizes?: number[];
}

export class AssetCleanupDto {
	@ApiPropertyOptional({ description: '资产ID列表（为空则不处理）', type: [String] })
	ids?: string[];
}

export class AssetBindDto {
	@ApiProperty({ description: '数据表名' })
	tableName!: string;

	@ApiProperty({ description: '记录ID' })
	rowId!: string;

	@ApiProperty({ description: '字段名' })
	fieldName!: string;
}



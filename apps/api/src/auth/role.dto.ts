import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
	@ApiProperty({ description: '角色名称' })
	name!: string;

	@ApiPropertyOptional({ description: '是否启用', default: true })
	enabled?: boolean;

	@ApiPropertyOptional({ description: '菜单权限 key 列表', type: [String] })
	permissions?: string[];
}

export class UpdateRoleDto {
	@ApiPropertyOptional({ description: '角色名称' })
	name?: string;

	@ApiPropertyOptional({ description: '是否启用' })
	enabled?: boolean;

	@ApiPropertyOptional({ description: '菜单权限 key 列表', type: [String] })
	permissions?: string[];
}

export class CreateAdminDto {
	@ApiProperty({ description: '手机号' })
	phone!: string;

	@ApiPropertyOptional({ description: '昵称' })
	name?: string;

	@ApiProperty({ description: '密码（>=6位）' })
	password!: string;

	@ApiProperty({ description: '角色ID' })
	roleId!: number;

	@ApiPropertyOptional({ description: '头像URL（可为空）', nullable: true })
	avatarUrl?: string | null;
}

export class UpdateAdminDto {
	@ApiPropertyOptional({ description: '手机号' })
	phone?: string;

	@ApiPropertyOptional({ description: '昵称' })
	name?: string;

	@ApiPropertyOptional({ description: '密码（可选）' })
	password?: string;

	@ApiPropertyOptional({ description: '角色ID（可为空）', nullable: true })
	roleId?: number | null;

	@ApiPropertyOptional({ description: '头像URL（可为空）', nullable: true })
	avatarUrl?: string | null;
}



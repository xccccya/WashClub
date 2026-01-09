import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoleDto {
	@ApiProperty({ description: '角色名称' })
	@IsString()
	@IsNotEmpty({ message: '角色名称不能为空' })
	name!: string;

	@ApiPropertyOptional({ description: '是否启用', default: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '菜单权限 key 列表', type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	permissions?: string[];
}

export class UpdateRoleDto {
	@ApiPropertyOptional({ description: '角色名称' })
	@IsOptional()
	@IsString()
	@IsNotEmpty({ message: '角色名称不能为空' })
	name?: string;

	@ApiPropertyOptional({ description: '是否启用' })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '菜单权限 key 列表', type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	permissions?: string[];
}

export class CreateAdminDto {
	@ApiProperty({ description: '手机号' })
	@IsString()
	@IsNotEmpty({ message: '请输入手机号' })
	phone!: string;

	@ApiPropertyOptional({ description: '昵称' })
	@IsOptional()
	@IsString()
	@IsNotEmpty({ message: '请输入昵称' })
	name?: string;

	@ApiProperty({ description: '密码（>=6位）' })
	@IsString()
	@MinLength(6, { message: '密码至少6位' })
	password!: string;

	@ApiProperty({ description: '角色ID' })
	@Type(() => Number)
	@IsInt()
	roleId!: number;

	@ApiPropertyOptional({ description: '头像URL（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

export class UpdateAdminDto {
	@ApiPropertyOptional({ description: '手机号' })
	@IsOptional()
	@IsString()
	phone?: string;

	@ApiPropertyOptional({ description: '昵称' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: '密码（可选）' })
	@IsOptional()
	@IsString()
	@MinLength(6, { message: '密码至少6位' })
	password?: string;

	@ApiPropertyOptional({ description: '角色ID（可为空）', nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	roleId?: number | null;

	@ApiPropertyOptional({ description: '头像URL（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

// ===== 返回 DTO（用于 Swagger/OpenAPI & SDK 生成）=====

export class AdminRoleDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	enabled!: boolean;

	@ApiProperty({ description: '是否系统内置角色' })
	isSystem!: boolean;

	@ApiProperty({ type: [String], description: '权限 key 列表' })
	permissions!: string[];
}

export class AdminRoleOptionDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	enabled!: boolean;

	@ApiProperty()
	isSystem!: boolean;
}

export class AdminMenuDto {
	@ApiProperty()
	key!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	path!: string;
}

export class AdminUserDto {
	@ApiProperty()
	id!: number;

	@ApiPropertyOptional()
	name?: string;

	@ApiProperty()
	phone!: string;

	@ApiPropertyOptional({ nullable: true })
	roleId?: number | null;

	@ApiPropertyOptional({ type: () => AdminRoleDto, nullable: true })
	roleRef?: AdminRoleDto | null;

	@ApiPropertyOptional({ nullable: true })
	avatarUrl?: string | null;
}

export class AdminMeDto {
	@ApiProperty()
	id!: number;

	@ApiPropertyOptional()
	role?: string;

	@ApiPropertyOptional({ nullable: true })
	roleId?: number | null;

	@ApiPropertyOptional()
	phone?: string;

	@ApiPropertyOptional()
	name?: string;

	@ApiPropertyOptional({ nullable: true })
	avatarUrl?: string | null;

	@ApiPropertyOptional({ type: [String] })
	permissions?: string[];
}



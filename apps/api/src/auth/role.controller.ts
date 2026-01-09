import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRoleService, AdminMenuKey } from './role.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';
import { AdminMenuDto, AdminRoleDto, AdminRoleOptionDto, AdminUserDto, CreateAdminDto, CreateRoleDto, UpdateAdminDto, UpdateRoleDto } from './role.dto.js';

@ApiTags('system')
@Controller('system')
@UseGuards(AdminGuard)
export class AdminRoleController {
	constructor(private service: AdminRoleService) {}

	// 角色管理
	@Get('roles')
	@ApiOperation({ summary: '角色列表' })
	@RequirePerm('system-roles')
	@ApiOkResponse({ type: AdminRoleDto, isArray: true })
	listRoles() { return this.service.listRoles(); }

	@Get('roles/options')
	@ApiOperation({ summary: '角色选项（供管理员管理页选择）' })
	@RequirePerm('system-admins')
	@ApiOkResponse({ type: AdminRoleOptionDto, isArray: true })
	listRoleOptions() { return this.service.listRoleOptions(); }

	@Post('roles')
	@ApiOperation({ summary: '创建角色' })
	@RequirePerm('system-roles')
	@ApiCreatedResponse({ type: AdminRoleDto })
	createRole(@Body() body: CreateRoleDto) { return this.service.createRole(body as any); }

	@Put('roles/:id')
	@ApiOperation({ summary: '更新角色' })
	@RequirePerm('system-roles')
	@ApiOkResponse({ type: AdminRoleDto })
	updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto) {
		return this.service.updateRole(Number(id), body as any);
	}

	@Delete('roles/:id')
	@ApiOperation({ summary: '删除角色' })
	@RequirePerm('system-roles')
	@ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
	removeRole(@Param('id') id: string) { return this.service.removeRole(Number(id)); }

	// 管理员管理
	@Get('admins')
	@ApiOperation({ summary: '管理员列表' })
	@RequirePerm('system-admins')
	@ApiOkResponse({ type: AdminUserDto, isArray: true })
	listAdmins() { return this.service.listAdmins(); }

	@Post('admins')
	@ApiOperation({ summary: '创建管理员' })
	@RequirePerm('system-admins')
	@ApiCreatedResponse({ type: AdminUserDto })
	createAdmin(@Body() body: CreateAdminDto) { return this.service.createAdmin(body as any); }

	@Put('admins/:id')
	@ApiOperation({ summary: '更新管理员' })
	@RequirePerm('system-admins')
	@ApiOkResponse({ type: AdminUserDto })
	updateAdmin(@Param('id') id: string, @Body() body: UpdateAdminDto) {
		return this.service.updateAdmin(Number(id), body as any);
	}

	@Delete('admins/:id')
	@ApiOperation({ summary: '删除管理员' })
	@RequirePerm('system-admins')
	@ApiOkResponse({ type: AdminUserDto })
	removeAdmin(@Param('id') id: string) { return this.service.removeAdmin(Number(id)); }

	// 菜单清单
	@Get('menus')
	@ApiOperation({ summary: '系统菜单清单' })
	@RequirePerm('system-roles')
	@ApiOkResponse({ type: AdminMenuDto, isArray: true })
	listMenus() { return this.service.listMenus(); }
}




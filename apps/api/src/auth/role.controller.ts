import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRoleService, AdminMenuKey } from './role.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';

@ApiTags('system')
@Controller('system')
@UseGuards(AdminGuard)
export class AdminRoleController {
	constructor(private service: AdminRoleService) {}

	// 角色管理
	@Get('roles')
	@ApiOperation({ summary: '角色列表' })
	@RequirePerm('system-roles')
	listRoles() { return this.service.listRoles(); }

	@Post('roles')
	@ApiOperation({ summary: '创建角色' })
	@RequirePerm('system-roles')
	createRole(@Body() body: { name: string; enabled?: boolean; permissions?: AdminMenuKey[] }) { return this.service.createRole(body); }

	@Put('roles/:id')
	@ApiOperation({ summary: '更新角色' })
	@RequirePerm('system-roles')
	updateRole(@Param('id') id: string, @Body() body: { name?: string; enabled?: boolean; permissions?: AdminMenuKey[] }) {
		return this.service.updateRole(Number(id), body);
	}

	@Delete('roles/:id')
	@ApiOperation({ summary: '删除角色' })
	@RequirePerm('system-roles')
	removeRole(@Param('id') id: string) { return this.service.removeRole(Number(id)); }

	// 管理员管理
	@Get('admins')
	@ApiOperation({ summary: '管理员列表' })
	@RequirePerm('system-admins')
	listAdmins() { return this.service.listAdmins(); }

	@Post('admins')
	@ApiOperation({ summary: '创建管理员' })
	@RequirePerm('system-admins')
	createAdmin(@Body() body: { phone: string; name?: string; password: string; roleId: number }) { return this.service.createAdmin(body); }

	@Put('admins/:id')
	@ApiOperation({ summary: '更新管理员' })
	@RequirePerm('system-admins')
	updateAdmin(@Param('id') id: string, @Body() body: { phone?: string; name?: string; password?: string; roleId?: number | null }) {
		return this.service.updateAdmin(Number(id), body);
	}

	@Delete('admins/:id')
	@ApiOperation({ summary: '删除管理员' })
	@RequirePerm('system-admins')
	removeAdmin(@Param('id') id: string) { return this.service.removeAdmin(Number(id)); }

	// 菜单清单
	@Get('menus')
	@ApiOperation({ summary: '系统菜单清单' })
	@RequirePerm('system-roles')
	listMenus() { return this.service.listMenus(); }
}




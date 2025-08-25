import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRoleService, AdminMenuKey } from './role.service.js';

@ApiTags('system')
@Controller('system')
export class AdminRoleController {
	constructor(private service: AdminRoleService) {}

	// 角色管理
	@Get('roles')
	@ApiOperation({ summary: '角色列表' })
	listRoles() { return this.service.listRoles(); }

	@Post('roles')
	@ApiOperation({ summary: '创建角色' })
	createRole(@Body() body: { name: string; enabled?: boolean; permissions?: AdminMenuKey[] }) { return this.service.createRole(body); }

	@Put('roles/:id')
	@ApiOperation({ summary: '更新角色' })
	updateRole(@Param('id') id: string, @Body() body: { name?: string; enabled?: boolean; permissions?: AdminMenuKey[] }) {
		return this.service.updateRole(Number(id), body);
	}

	@Delete('roles/:id')
	@ApiOperation({ summary: '删除角色' })
	removeRole(@Param('id') id: string) { return this.service.removeRole(Number(id)); }

	// 管理员管理
	@Get('admins')
	@ApiOperation({ summary: '管理员列表' })
	listAdmins() { return this.service.listAdmins(); }

	@Post('admins')
	@ApiOperation({ summary: '创建管理员' })
	createAdmin(@Body() body: { phone: string; name?: string; password: string; roleId: number }) { return this.service.createAdmin(body); }

	@Put('admins/:id')
	@ApiOperation({ summary: '更新管理员' })
	updateAdmin(@Param('id') id: string, @Body() body: { phone?: string; name?: string; password?: string; roleId?: number | null }) {
		return this.service.updateAdmin(Number(id), body);
	}

	@Delete('admins/:id')
	@ApiOperation({ summary: '删除管理员' })
	removeAdmin(@Param('id') id: string) { return this.service.removeAdmin(Number(id)); }

	// 菜单清单
	@Get('menus')
	@ApiOperation({ summary: '系统菜单清单' })
	listMenus() { return this.service.listMenus(); }
}




import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRoleService, AdminMenuKey } from './role.service.js';

@ApiTags('system')
@Controller('system')
export class AdminRoleController {
	constructor(private service: AdminRoleService) {}

	// 角色管理
	@Get('roles')
	listRoles() { return this.service.listRoles(); }

	@Post('roles')
	createRole(@Body() body: { name: string; enabled?: boolean; permissions?: AdminMenuKey[] }) { return this.service.createRole(body); }

	@Put('roles/:id')
	updateRole(@Param('id') id: string, @Body() body: { name?: string; enabled?: boolean; permissions?: AdminMenuKey[] }) {
		return this.service.updateRole(Number(id), body);
	}

	@Delete('roles/:id')
	removeRole(@Param('id') id: string) { return this.service.removeRole(Number(id)); }

	// 管理员管理
	@Get('admins')
	listAdmins() { return this.service.listAdmins(); }

	@Post('admins')
	createAdmin(@Body() body: { phone: string; name?: string; password: string; roleId: number }) { return this.service.createAdmin(body); }

	@Put('admins/:id')
	updateAdmin(@Param('id') id: string, @Body() body: { phone?: string; name?: string; password?: string; roleId?: number | null }) {
		return this.service.updateAdmin(Number(id), body);
	}

	@Delete('admins/:id')
	removeAdmin(@Param('id') id: string) { return this.service.removeAdmin(Number(id)); }

	// 菜单清单
	@Get('menus')
	listMenus() { return this.service.listMenus(); }
}




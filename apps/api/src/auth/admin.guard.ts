import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { PERM_KEY } from './perm.decorator.js';
import { extractBearerTokenFromHeaders } from './bearer.js';

// 管理员自助接口：只要是已登录管理员就允许（不依赖角色权限配置）
const ADMIN_SELF_PERM = 'admin-self' as const;

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private jwt: JwtService, private prisma: PrismaService, private reflector: Reflector) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req: any = context.switchToHttp().getRequest();
		const token = extractBearerTokenFromHeaders(req?.headers);
		if (!token) throw new UnauthorizedException('未登录');
		let decoded: any;
		try { decoded = this.jwt.verify(token); } catch { throw new UnauthorizedException('登录已过期'); }
		if (!decoded || decoded.type !== 'admin' || !decoded.sub) throw new UnauthorizedException('身份无效');
		const userId = Number(decoded.sub);
		if (!Number.isFinite(userId) || userId <= 0) throw new UnauthorizedException('身份无效');
		const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roleRef: true } });
		if (!user) throw new UnauthorizedException('账户不存在');
		if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new ForbiddenException('该角色已被禁用');
		const permissions: string[] = Array.isArray(user.roleRef?.permissions) ? (user.roleRef?.permissions as any) : [];
		// 权限校验
		const requiredPerm = this.reflector.getAllAndOverride<string | undefined>(PERM_KEY, [context.getHandler(), context.getClass()]);
		if (requiredPerm) {
			// 明确策略：管理员自助接口（更换昵称/头像/密码、me 校验等）对所有管理员开放
			if (requiredPerm !== ADMIN_SELF_PERM) {
				if (!(permissions.includes('*') || permissions.includes(requiredPerm))) {
					throw new ForbiddenException('无权限');
				}
			}
		}
		// 注入 request.user 便于后续使用
		req.user = {
			id: user.id,
			roleId: user.roleId,
			role: user.role,
			phone: user.phone,
			name: user.name ?? '',
			avatarUrl: (user as any).avatarUrl ?? null,
			permissions,
		};
		return true;
	}
}

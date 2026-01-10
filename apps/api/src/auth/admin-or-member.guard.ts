import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { extractBearerTokenFromHeaders } from './bearer.js';

/**
 * 允许 admin / member 已登录访问（不做后台权限键校验）。
 * 用途：/assets/upload 需要兼容小程序 member token 上传，但不允许匿名。
 */
@Injectable()
export class AdminOrMemberGuard implements CanActivate {
	constructor(private jwt: JwtService, private prisma: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req: any = context.switchToHttp().getRequest();
		const token = extractBearerTokenFromHeaders(req?.headers);
		if (!token) throw new UnauthorizedException('未登录');

		let decoded: any;
		try {
			decoded = this.jwt.verify(token);
		} catch {
			throw new UnauthorizedException('登录已过期');
		}

		const type = String(decoded?.type || '');
		const sub = Number(decoded?.sub);
		if (!Number.isFinite(sub) || sub <= 0) throw new UnauthorizedException('身份无效');

		// ====== admin ======
		if (type === 'admin') {
			const user = await this.prisma.user.findUnique({ where: { id: sub }, include: { roleRef: true } });
			if (!user) throw new UnauthorizedException('账户不存在');
			if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new ForbiddenException('该角色已被禁用');
			const permissions: string[] = Array.isArray(user.roleRef?.permissions) ? (user.roleRef?.permissions as any) : [];

			req.user = {
				kind: 'admin',
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

		// ====== member ======
		if (type === 'member') {
			const member = await this.prisma.member.findUnique({ where: { id: sub }, select: { id: true } }).catch(() => null);
			if (!member) throw new UnauthorizedException('账户不存在');
			req.user = { kind: 'member', memberId: sub } as any;
			return true;
		}

		throw new UnauthorizedException('身份无效');
	}
}


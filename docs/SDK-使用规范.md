# SDK 使用规范（最小版）

本项目后端接口调用统一通过 `@wash/api-client`（OpenAPI + orval 生成）。

## 统一规则

- **业务接口必须使用 SDK**：`import { xxxControllerYyy } from '@wash/api-client'`
- **禁止内部路径导入**：
  - ✅ `@wash/api-client`
  - ❌ `@wash/api-client/src/...`
  - ✅ `@wash/shared-utils`
  - ❌ `@wash/shared-utils/src/...`
- **仅允许例外**（可以直连）：
  - 文件上传：`/assets/upload`（`fetch` / `uni.uploadFile`）
  - WebSocket：`/ws`
  - 第三方接口：如 AMap

## Web 端示例（web-admin / web-pos）

```ts
import { memberControllerList } from '@wash/api-client';

export async function searchMembers(keyword: string) {
  const res: any = await memberControllerList({ page: 1, pageSize: 20, keyword } as any);
  return res?.items || [];
}
```

## 小程序示例（miniapp-uni）

SDK 底层会优先使用 `uni.request`，并默认从小程序 storage 读取 `token`；`baseUrl` 由运行环境注入（本项目由 `apps/miniapp-uni/src/utils/auth.ts` 负责设置）。

```ts
import { vehicleControllerMyVehicles } from '@wash/api-client';

export async function loadMyVehicles() {
  const list: any = await vehicleControllerMyVehicles({} as any);
  return Array.isArray(list) ? list : [];
}
```

## 上传示例（例外）

```ts
// 允许：上传属于例外，不走 SDK
uni.uploadFile({
  url: `${API_BASE}/assets/upload`,
  filePath,
  name: 'file',
  header: { Authorization: `Bearer ${token}` },
  formData: { dir: 'miniapp', source: 'xxx' },
});
```



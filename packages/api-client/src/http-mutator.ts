// SDK 生成物的 mutator：统一从包依赖 @wash/shared-utils 引用 createHttpClient
// 注意：orval 需要能静态分析到本文件里“直接导出的函数/常量”，因此不能用 re-export 写法。
import { createHttpClient as _createHttpClient } from '@wash/shared-utils';

// orval 需要显式的函数导出（不能仅仅导出常量引用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHttpClient<T>(...args: any[]): Promise<T> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (_createHttpClient as any)(...args) as Promise<T>;
}



# Supabase 云同步设置

1. 打开 [supabase.com](https://supabase.com/)，注册或登录。
2. 创建一个新项目。区域可选择新加坡或东京。
3. 打开项目左侧的 **SQL Editor**。
4. 复制 `supabase-schema.sql` 的全部内容，粘贴并运行。
5. 打开 **Authentication → Providers → Email**，保持启用。
6. 打开 **Project Settings → API**，复制：
   - Project URL
   - `anon` / `public` key

不要发送或公开 `service_role` key。

完成以上步骤后，把 Project URL 和 `anon` key 发到对话中，即可继续接入云同步。

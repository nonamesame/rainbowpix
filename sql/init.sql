-- Supabase 初始化 SQL

-- 1. generations 表
CREATE TABLE generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT,
    negative_prompt TEXT,
    model TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- 2. audit_logs 表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- 3. examples 表
CREATE TABLE examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT,
    prompt TEXT,
    negative_prompt TEXT,
    model TEXT,
    width INT DEFAULT 1024,
    height INT DEFAULT 1024,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_builtin BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    category TEXT DEFAULT 'style',
    created_at TIMESTAMP DEFAULT now()
);

-- 4. complaints 表
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- 启用 RLS
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- generations RLS: 用户只能读写自己的记录
CREATE POLICY "generations_select_own" ON generations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "generations_insert_own" ON generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "generations_update_own" ON generations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "generations_delete_own" ON generations
    FOR DELETE USING (auth.uid() = user_id);

-- audit_logs RLS: 用户只能读自己的记录
CREATE POLICY "audit_logs_select_own" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "audit_logs_insert_own" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- examples RLS: 公开和内置示例全员可读，作者可管理自己的示例
CREATE POLICY "examples_select_public" ON examples
    FOR SELECT USING (is_public = true OR is_builtin = true);

CREATE POLICY "examples_select_own" ON examples
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "examples_insert_own" ON examples
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "examples_update_own" ON examples
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "examples_delete_own" ON examples
    FOR DELETE USING (auth.uid() = author_id);

-- complaints RLS: 任何人都可以提交投诉
CREATE POLICY "complaints_insert_any" ON complaints
    FOR INSERT WITH CHECK (true);

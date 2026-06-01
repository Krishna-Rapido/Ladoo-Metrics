-- ============================================================================
-- Researcher Chat Persistence — Supabase Migration
-- Run this in the Supabase SQL Editor before using chat persistence.
-- ============================================================================

-- 1. Researcher Chats
CREATE TABLE IF NOT EXISTS researcher_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE researcher_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
    ON researcher_chats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats"
    ON researcher_chats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats"
    ON researcher_chats FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
    ON researcher_chats FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_researcher_chats_user_id ON researcher_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_researcher_chats_updated_at ON researcher_chats(updated_at DESC);


-- 2. Researcher Chat Messages
CREATE TABLE IF NOT EXISTS researcher_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES researcher_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    sequence_num INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE researcher_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
    ON researcher_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM researcher_chats
            WHERE researcher_chats.id = researcher_chat_messages.chat_id
            AND researcher_chats.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own chat messages"
    ON researcher_chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM researcher_chats
            WHERE researcher_chats.id = researcher_chat_messages.chat_id
            AND researcher_chats.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_researcher_chat_messages_chat_id ON researcher_chat_messages(chat_id, sequence_num);


-- 3. Researcher Rules
CREATE TABLE IF NOT EXISTS researcher_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES researcher_chats(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('table', 'filter', 'analysis', 'custom')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE researcher_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules"
    ON researcher_rules FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own rules"
    ON researcher_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
    ON researcher_rules FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
    ON researcher_rules FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_researcher_rules_user_id ON researcher_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_researcher_rules_chat_id ON researcher_rules(chat_id);


-- 4. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_researcher_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_researcher_chats_updated_at
    BEFORE UPDATE ON researcher_chats
    FOR EACH ROW EXECUTE FUNCTION update_researcher_updated_at();

CREATE TRIGGER trigger_researcher_rules_updated_at
    BEFORE UPDATE ON researcher_rules
    FOR EACH ROW EXECUTE FUNCTION update_researcher_updated_at();

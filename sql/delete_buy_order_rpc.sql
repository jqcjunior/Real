-- Function to securely delete a buy order
CREATE OR REPLACE FUNCTION delete_buy_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order_status TEXT;
    v_order_exists BOOLEAN;
    v_user_role TEXT;
    v_auth_role TEXT;
BEGIN
    -- 1. Verificar se o usuário está autenticado
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Usuário não autenticado.'
        );
    END IF;

    -- 2. Verificar permissão (Admin, Manager ou Super Admin)
    v_auth_role := auth.jwt() ->> 'role';
    IF v_auth_role NOT IN ('admin', 'manager', 'super_admin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Você não tem permissão para excluir pedidos.'
        );
    END IF;

    -- 3. Verificar se o pedido existe e capturar status
    SELECT exists(SELECT 1 FROM buy_orders WHERE id = p_order_id), status
    INTO v_order_exists, v_order_status
    FROM buy_orders
    WHERE id = p_order_id;

    IF NOT v_order_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Pedido não encontrado.'
        );
    END IF;

    -- 4. Verificar se o status permite exclusão (Rascunho ou Stand-by)
    -- Normalizar para lowercase para comparação segura
    IF LOWER(v_order_status) NOT IN ('rascunho', 'stand_by', 'standby') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', format('Não é possível excluir um pedido com status "%s". Apenas rascunhos ou pedidos em stand-by podem ser excluídos.', v_order_status)
        );
    END IF;

    -- 5. Deletar dependências em Cascata (Caso não haja ON DELETE CASCADE configurado)
    -- a) Grades dos sub-pedidos dos itens
    DELETE FROM buy_order_item_suborder_grades
    WHERE item_id IN (SELECT id FROM buy_order_items WHERE order_id = p_order_id);

    -- b) Itens do pedido
    DELETE FROM buy_order_items
    WHERE order_id = p_order_id;

    -- c) Sub-pedidos (distribuição por loja)
    DELETE FROM buy_order_sub_orders
    WHERE order_id = p_order_id;

    -- d) Transações de cota (Geralmente lidado pelo trigger, mas garantimos aqui se necessário)
    DELETE FROM buyorder_quota_transactions
    WHERE order_id = p_order_id;

    -- e) Referências em cota extra
    UPDATE buyorder_quota_extra SET order_id = NULL WHERE order_id = p_order_id;

    -- f) O pedido principal
    DELETE FROM buy_orders
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pedido excluído definitivamente!',
        'deleted_order_id', p_order_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', format('Erro interno ao excluir pedido: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o PostgREST veja a nova função
NOTIFY pgrst, 'reload schema';

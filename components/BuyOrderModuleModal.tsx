import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { toast } from "sonner";

interface BuyOrderModuleModalProps {
  order: any;
  onClose: () => void;
  onSave: () => void;
}

export function BuyOrderModuleModal({
  order,
  onClose,
  onSave,
}: BuyOrderModuleModalProps) {
  const [formData, setFormData] = useState({
    marca: order.marca || "",
    fornecedor: order.fornecedor || "",
    representante: order.representante || "",
    telefone: order.telefone || "",
    email: order.email || "",
    fat_inicio: order.fat_inicio || "",
    fat_fim: order.fat_fim || "",
    prazos: Array.isArray(order.prazos) ? order.prazos : [],
    desconto: order.desconto || 0,
    markup: order.markup || 0,
  });

  const [loading, setLoading] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);

  const [deletedItems, setDeletedItems] = useState<string[]>([]);

  // Inicializar editableItems quando o modal abre
  useEffect(() => {
    if (order.buy_order_items) {
      setEditableItems(JSON.parse(JSON.stringify(order.buy_order_items)));
      setDeletedItems([]);
    }
  }, [order.buy_order_items]);

  const subOrders = order.buy_order_sub_orders || [];

  const isAcessorio =
    order.modelo?.toLowerCase().includes("acess") ||
    order.modelo?.toLowerCase().includes("item");
  const label = isAcessorio ? "ITENS" : "PARES";

  // Calcular totais baseados em editableItems
  const totalPares = editableItems.reduce(
    (sum: number, item: any) => sum + (item.total_pares || 0),
    0,
  );
  const totalCusto = editableItems.reduce(
    (sum: number, item: any) =>
      sum + (item.total_pares || 0) * (item.custo || 0),
    0,
  );
  const totalVenda = editableItems.reduce(
    (sum: number, item: any) =>
      sum + (item.total_pares || 0) * (item.preco_venda || 0),
    0,
  );

  // Calcular markup dinâmico e parcelas
  const markupCalculado = totalCusto > 0 ? totalVenda / totalCusto : 0;
  const numParcelas = formData.prazos.length || 1;
  const valorParcela = totalCusto / numParcelas;

  // Calcular vencimentos
  const vencimentos = formData.prazos.map((prazo: number) => {
    if (!formData.fat_fim) return "";
    const d = new Date(formData.fat_fim + "T00:00:00");
    d.setDate(d.getDate() + prazo);
    const meses = [
      "JAN",
      "FEV",
      "MAR",
      "ABR",
      "MAI",
      "JUN",
      "JUL",
      "AGO",
      "SET",
      "OUT",
      "NOV",
      "DEZ",
    ];
    return `${meses[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
  });

  const handleAddItem = () => {
    setEditableItems([
      ...editableItems,
      {
        id: undefined, // undefined indicates it's a new item
        referencia: "",
        tipo: "",
        total_pares: 0,
        custo: 0,
        preco_venda: 0,
      },
    ]);
    if (!showAllItems && editableItems.length >= 5) {
      setShowAllItems(true);
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...editableItems];
    const removedItem = updated[index];
    if (removedItem.id) {
      setDeletedItems((prev) => [...prev, removedItem.id]);
    }
    updated.splice(index, 1);
    setEditableItems(updated);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...editableItems];

    if (
      field === "total_pares" ||
      field === "custo" ||
      field === "preco_venda"
    ) {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }

    setEditableItems(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error: orderError } = await supabase
        .from("buy_orders")
        .update(formData)
        .eq("id", order.id);

      if (orderError) throw orderError;

      // 2. Excluir itens removidos
      if (deletedItems.length > 0) {
        const { error: deleteError } = await supabase
          .from("buy_order_items")
          .delete()
          .in("id", deletedItems);

        if (deleteError) {
          console.error("Erro ao excluir itens:", deleteError);
          throw deleteError;
        }
      }

      // 3. Atualizar ou Inserir cada item do pedido
      let orderIndex = editableItems.length;
      for (const item of editableItems) {
        if (item.id) {
          const { error: itemError } = await supabase
            .from("buy_order_items")
            .update({
              referencia: item.referencia,
              tipo: item.tipo,
              total_pares: item.total_pares,
              custo: item.custo,
              preco_venda: item.preco_venda,
            })
            .eq("id", item.id);

          if (itemError) {
            console.error("Erro ao atualizar item:", item.id, itemError);
            throw itemError;
          }
        } else {
          const { error: itemError } = await supabase
            .from("buy_order_items")
            .insert({
              order_id: order.id,
              item_order: ++orderIndex,
              referencia: item.referencia,
              tipo: item.tipo,
              total_pares: item.total_pares,
              custo: item.custo,
              preco_venda: item.preco_venda,
              grades: [], // nova grade padrão
            });

          if (itemError) {
            console.error("Erro ao inserir item:", itemError);
            throw itemError;
          }
        }
      }

      toast.success("✅ Pedido e itens atualizados com sucesso!");
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const itemsToShow = showAllItems ? editableItems : editableItems.slice(0, 5);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #185FA5 0%, #1e40af 100%)",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              📦 Pedido #{order.numero_pedido} - {order.marca}
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
              {totalPares} {label.toLowerCase()} • {fmtBRL(totalVenda)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            ✕
          </button>
        </div>

        {/* BODY - SCROLLABLE */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
          }}
        >
          {/* SEÇÃO 1: DADOS DO FORNEC准 */}
          <div
            style={{
              marginBottom: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              📋 Dados do Fornecedor
            </div>
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    MARCA
                  </label>
                  <input
                    value={formData.marca}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        marca: e.target.value.toUpperCase(),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    FORNECEDOR
                  </label>
                  <input
                    value={formData.fornecedor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fornecedor: e.target.value.toUpperCase(),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    REPRESENTANTE
                  </label>
                  <input
                    value={formData.representante}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        representante: e.target.value.toUpperCase(),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    TELEFONE
                  </label>
                  <input
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    EMAIL
                  </label>
                  <input
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value.toLowerCase(),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: FATURAMENTO */}
          <div
            style={{
              marginBottom: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              📅 Faturamento e Condições
            </div>
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 2fr",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    DATA INICIAL
                  </label>
                  <input
                    type="date"
                    value={formData.fat_inicio}
                    onChange={(e) =>
                      setFormData({ ...formData, fat_inicio: e.target.value })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    DATA FINAL
                  </label>
                  <input
                    type="date"
                    value={formData.fat_fim}
                    onChange={(e) =>
                      setFormData({ ...formData, fat_fim: e.target.value })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    PRAZOS (separados por /)
                  </label>
                  <input
                    value={formData.prazos.join("/")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        prazos: e.target.value
                          .split("/")
                          .map((p) => parseInt(p.trim()))
                          .filter((n) => !isNaN(n)),
                      })
                    }
                    placeholder="90/120/150"
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {vencimentos.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    VENCIMENTOS
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {vencimentos.map((v, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#dbeafe",
                          color: "#1e40af",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    DESCONTO (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.desconto}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        desconto: parseFloat(e.target.value) || 0,
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#dc2626",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    MARKUP (x)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={formData.markup}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        markup: parseFloat(e.target.value) || 0,
                      })
                    }
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#059669",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: ITENS (READ-ONLY) */}
          <div
            style={{
              marginBottom: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                📦 Itens do Pedido ({editableItems.length} itens - {totalPares}{" "}
                {label.toLowerCase()})
              </span>
              {editableItems.length > 5 && (
                <button
                  onClick={() => setShowAllItems(!showAllItems)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#185FA5",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {showAllItems ? "▲ Mostrar menos" : "▼ Ver todos"}
                </button>
              )}
            </div>
            <div style={{ padding: 0 }}>
              <table style={{ width: "100%", fontSize: 11 }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "12%",
                      }}
                    >
                      Ref
                    </th>
                    <th
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "45%",
                      }}
                    >
                      Tipo
                    </th>
                    <th
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "10%",
                      }}
                    >
                      {label}
                    </th>
                    <th
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "13%",
                      }}
                    >
                      Custo
                    </th>
                    <th
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "13%",
                      }}
                    >
                      Venda
                    </th>
                    <th
                      style={{
                        padding: "8px 4px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        width: "7%",
                      }}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllItems
                    ? editableItems
                    : editableItems.slice(0, 5)
                  ).map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      {/* Referência - Editável */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="text"
                          value={item.referencia || ""}
                          onChange={(e) =>
                            handleItemChange(i, "referencia", e.target.value)
                          }
                          onFocus={(e) =>
                            (e.target.style.background = "#f0f9ff")
                          }
                          onBlur={(e) => (e.target.style.background = "#fff")}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#fff",
                          }}
                        />
                      </td>

                      {/* Tipo - Editável */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="text"
                          value={item.tipo || ""}
                          onChange={(e) =>
                            handleItemChange(
                              i,
                              "tipo",
                              e.target.value.toUpperCase(),
                            )
                          }
                          onFocus={(e) =>
                            (e.target.style.background = "#f0f9ff")
                          }
                          onBlur={(e) => (e.target.style.background = "#fff")}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 10,
                            background: "#fff",
                          }}
                        />
                      </td>

                      {/* Pares - Editável */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="number"
                          min="0"
                          value={item.total_pares || 0}
                          onChange={(e) =>
                            handleItemChange(i, "total_pares", e.target.value)
                          }
                          onFocus={(e) =>
                            (e.target.style.background = "#f0f9ff")
                          }
                          onBlur={(e) => (e.target.style.background = "#fff")}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#059669",
                            textAlign: "center",
                            background: "#fff",
                          }}
                        />
                      </td>

                      {/* Custo - Editável */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.custo || 0}
                          onChange={(e) =>
                            handleItemChange(i, "custo", e.target.value)
                          }
                          onFocus={(e) =>
                            (e.target.style.background = "#f0f9ff")
                          }
                          onBlur={(e) => (e.target.style.background = "#fff")}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 11,
                            textAlign: "right",
                            background: "#fff",
                          }}
                        />
                      </td>

                      {/* Venda - Editável */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.preco_venda || 0}
                          onChange={(e) =>
                            handleItemChange(i, "preco_venda", e.target.value)
                          }
                          onFocus={(e) =>
                            (e.target.style.background = "#f0f9ff")
                          }
                          onBlur={(e) => (e.target.style.background = "#fff")}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#185FA5",
                            textAlign: "right",
                            background: "#fff",
                          }}
                        />
                      </td>

                      {/* Botão Remover */}
                      <td style={{ padding: "6px 4px", textAlign: "center" }}>
                        <button
                          title="Remover Item"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Tem certeza que deseja remover este item?",
                              )
                            ) {
                              handleRemoveItem(i);
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#fee2e2")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid #e5e7eb",
                  background: "#f8fafc",
                }}
              >
                <button
                  onClick={handleAddItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "#185FA5",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#1e40af")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#185FA5")
                  }
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>{" "}
                  Adicionar Novo Item
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: LOJAS (READ-ONLY) */}
          <div
            style={{
              marginBottom: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              🏪 Lojas Vinculadas
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {subOrders
                  .flatMap((sub: any) => sub.lojas_numeros || [])
                  .map((loja: number, i: number) => (
                    <span
                      key={i}
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #93c5fd",
                      }}
                    >
                      Loja {loja}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* SEÇÃO 5: RESUMO FINANCEIRO (READ-ONLY) */}
          <div
            style={{
              marginBottom: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              💰 Resumo Financeiro
            </div>
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}
                  >
                    TOTAL DE {label}
                  </div>
                  <div
                    style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}
                  >
                    {totalPares}
                  </div>
                </div>
                <div>
                  <div
                    style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}
                  >
                    INVESTIMENTO TOTAL
                  </div>
                  <div
                    style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}
                  >
                    {fmtBRL(totalCusto)}
                  </div>
                  {numParcelas > 1 && vencimentos.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 4,
                      }}
                    >
                      {vencimentos.map((venc, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 11,
                            color: "#991b1b",
                            fontWeight: 500,
                          }}
                        >
                          {venc}: {fmtBRL(valorParcela)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {numParcelas > 1 && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "10px 14px",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#0369a1",
                  }}
                >
                  ℹ️ Este pedido terá abatimentos nas cotas futuras conforme os meses acima (prazos definidos).
                </div>
              )}
            </div>
          </div>

          {/* INFO RODAPÉ */}
          <div
            style={{
              background: "#f9fafb",
              padding: 12,
              borderRadius: 8,
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            <div>
              📝 Criado por: <strong>{order.user_name}</strong> (
              {order.user_role === "comprador" ? "COMPRADOR" : "GERENTE"}) em{" "}
              {new Date(order.created_at).toLocaleString("pt-BR")}
            </div>
            {order.exported_at && (
              <div>
                📤 Exportado em:{" "}
                <strong>
                  {new Date(order.exported_at).toLocaleString("pt-BR")}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              height: 40,
              padding: "0 24px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#94a3b8" : "#185FA5",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? "⏳ Salvando..." : "💾 Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

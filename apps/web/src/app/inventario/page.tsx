'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@restaurante/ui';
import { AuthGate, routeForRole, useAuth } from '../auth-provider';

type MovementType = 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT' | 'WASTE' | 'RETURN';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  costPerUnit: number;
  averageCost?: number;
  isActive: boolean;
}

interface MenuItem {
  id: string;
  name: string;
}

interface RecipeLine {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  ingredient?: Ingredient;
}

interface Movement {
  id: string;
  ingredientId: string;
  type: MovementType;
  quantity: number;
  reason: string;
  ingredient?: Ingredient;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) return quantity;
  if (from === 'kg' && to === 'g') return quantity * 1000;
  if (from === 'g' && to === 'kg') return quantity / 1000;
  if (from === 'l' && to === 'ml') return quantity * 1000;
  if (from === 'ml' && to === 'l') return quantity / 1000;

  return quantity;
}

function normalizeUnit(unit: string) {
  const value = unit.toLowerCase();
  if (['gramos', 'gramo', 'g'].includes(value)) return 'g';
  if (['kilogramos', 'kilogramo', 'kg'].includes(value)) return 'kg';
  if (['mililitros', 'mililitro', 'ml'].includes(value)) return 'ml';
  if (['litros', 'litro', 'l'].includes(value)) return 'l';
  return 'unit';
}

function money(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function normalizeIngredient(ingredient: Ingredient) {
  return {
    ...ingredient,
    costPerUnit: Number(ingredient.costPerUnit ?? ingredient.averageCost ?? 0),
    currentStock: Number(ingredient.currentStock),
    minimumStock: Number(ingredient.minimumStock)
  };
}

async function readApi<T>(response: Response) {
  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json() as Promise<T>;
}

export default function InventoryPage() {
  const { accessToken, logout, user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<RecipeLine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const lowStockIngredients = ingredients.filter((ingredient) => ingredient.isActive && ingredient.currentStock <= ingredient.minimumStock);
  const homeRoute = user ? routeForRole(user.role) : '/login';
  const selectedRecipe = recipes.filter((recipe) => recipe.menuItemId === selectedMenuItemId);

  async function signOut() {
    await logout();
    window.location.assign('/login');
  }

  const estimatedCost = useMemo(() => {
    return selectedRecipe.reduce((total, line) => {
      const ingredient = ingredients.find((item) => item.id === line.ingredientId);
      if (!ingredient) return total;
      const quantity = convertQuantity(line.quantity, line.unit, ingredient.unit);
      return total + quantity * ingredient.costPerUnit;
    }, 0);
  }, [ingredients, selectedRecipe]);

  useEffect(() => {
    if (!accessToken) return;
    void loadInventoryData();
  }, [accessToken]);

  async function loadInventoryData() {
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    try {
      const [ingredientsResponse, recipesResponse, movementsResponse, menuItemsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/inventory/ingredients`, { headers }),
        fetch(`${apiBaseUrl}/inventory/recipes`, { headers }),
        fetch(`${apiBaseUrl}/inventory/movements`, { headers }),
        fetch(`${apiBaseUrl}/menu/items`, { headers })
      ]);
      const nextIngredients = (await readApi<Ingredient[]>(ingredientsResponse)).map(normalizeIngredient);
      const nextRecipes = await readApi<RecipeLine[]>(recipesResponse);
      const nextMovements = await readApi<Movement[]>(movementsResponse);
      const nextMenuItems = (await readApi<Array<{ id: string; name: string }>>(menuItemsResponse)).map((item) => ({ id: item.id, name: item.name }));

      setIngredients(nextIngredients);
      setRecipes(nextRecipes);
      setMovements(nextMovements);
      setMenuItems(nextMenuItems);
      setSelectedMenuItemId((current) => nextMenuItems.some((item) => item.id === current) ? current : nextMenuItems[0]?.id ?? '');
      setFeedback('Inventario sincronizado con PostgreSQL.');
    } catch {
      setFeedback('Error de conexion con el servidor.');
    }
  }

  async function saveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const form = new FormData(event.currentTarget);
    const ingredient = {
      name: String(form.get('name') ?? '').trim(),
      unit: String(form.get('unit') ?? 'unidad'),
      currentStock: Number(form.get('currentStock') ?? 0),
      minimumStock: Number(form.get('minimumStock') ?? 0),
      averageCost: Number(form.get('costPerUnit') ?? 0)
    };

    if (!ingredient.name) return;

    setIsSaving(true);
    try {
      await readApi<Ingredient>(await fetch(`${apiBaseUrl}/inventory/ingredients`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(ingredient)
      }));
      await loadInventoryData();
      setFeedback('Ingrediente creado correctamente.');
      event.currentTarget.reset();
    } catch {
      setFeedback('No se pudo guardar el ingrediente.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const form = new FormData(event.currentTarget);
    const line = {
      menuItemId: selectedMenuItemId,
      ingredientId: String(form.get('ingredientId')),
      quantity: Number(form.get('quantity') ?? 0),
      unit: String(form.get('unit') ?? 'unidad')
    };

    if (!line.ingredientId || line.quantity <= 0) return;
    setIsSaving(true);
    try {
      await readApi<RecipeLine>(await fetch(`${apiBaseUrl}/inventory/recipes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(line)
      }));
      await loadInventoryData();
      setFeedback('Receta guardada correctamente.');
      event.currentTarget.reset();
    } catch {
      setFeedback('No se pudo guardar la receta.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const form = new FormData(event.currentTarget);
    const movement = {
      ingredientId: String(form.get('ingredientId')),
      type: String(form.get('type')) as MovementType,
      quantity: Number(form.get('quantity') ?? 0),
      reason: String(form.get('reason') ?? '').trim()
    };

    setIsSaving(true);
    try {
      await readApi<Movement>(await fetch(`${apiBaseUrl}/inventory/movements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(movement)
      }));
      await loadInventoryData();
      setFeedback('Movimiento registrado correctamente.');
      event.currentTarget.reset();
    } catch {
      setFeedback('No se pudo registrar el movimiento.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthGate allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY']}>
      <main className="inventory-shell">
      <header className="topbar">
        <div>
          <nav className="breadcrumb" aria-label="Ruta">
            <button type="button" onClick={() => window.location.assign(homeRoute)}>Inicio</button>
            <span>/</span>
            <strong>Inventario</strong>
          </nav>
          <p className="eyebrow">Fase 8</p>
          <h1>Inventario y recetas</h1>
          <span className="screen-action">Crear ingrediente, crear receta y registrar movimientos.</span>
        </div>
        <button className="secondary-action" type="button" onClick={() => void signOut()}>
          Salir / cambiar usuario
        </button>
        <button className="back-button" type="button" onClick={() => document.querySelector('.inventory-layout')?.scrollIntoView({ behavior: 'smooth' })}>
          ← Volver a inventario
        </button>
        <div className="shift-summary">
          <strong>{lowStockIngredients.length}</strong>
          <span>alertas</span>
        </div>
      </header>
      {feedback && <div className="pos-feedback">{feedback}</div>}

      <section className="inventory-layout">
        <section className="panel inventory-panel-wide">
          <div className="section-title">
            <h2>Ingredientes</h2>
            <span>Stock actual</span>
          </div>
          <div className="ingredient-grid">
            {ingredients.map((ingredient) => (
              <article className={ingredient.currentStock <= ingredient.minimumStock ? 'ingredient-card low' : 'ingredient-card'} key={ingredient.id}>
                <div>
                  <strong>{ingredient.name}</strong>
                  <span>{ingredient.unit}</span>
                </div>
                <strong>
                  {ingredient.currentStock} {ingredient.unit}
                </strong>
                <em>Minimo {ingredient.minimumStock}</em>
                <span>{money(ingredient.costPerUnit)} / {ingredient.unit}</span>
              </article>
            ))}
            {ingredients.length === 0 && <div className="empty-state compact">No hay ingredientes cargados desde el servidor.</div>}
          </div>
        </section>

        <aside className="panel">
          <div className="section-title">
            <h2>Crear ingrediente</h2>
          </div>
          <form className="inventory-form" onSubmit={saveIngredient}>
            <input name="name" placeholder="Nombre" />
            <select name="unit" defaultValue="gramos">
              <option value="gramos">Gramos</option>
              <option value="kilogramos">Kilogramos</option>
              <option value="mililitros">Mililitros</option>
              <option value="litros">Litros</option>
              <option value="unidad">Unidades</option>
            </select>
            <input name="currentStock" type="number" min="0" placeholder="Stock actual" />
            <input name="minimumStock" type="number" min="0" placeholder="Stock minimo" />
            <input name="costPerUnit" type="number" min="0" placeholder="Costo por unidad" />
            <Button disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar ingrediente'}</Button>
          </form>
        </aside>

        <section className="panel">
          <div className="section-title">
            <h2>Alertas bajo stock</h2>
            <span>{lowStockIngredients.length}</span>
          </div>
          <div className="alert-list">
            {lowStockIngredients.map((ingredient) => (
              <article key={ingredient.id}>
                <strong>{ingredient.name}</strong>
                <span>{ingredient.currentStock} / minimo {ingredient.minimumStock}</span>
              </article>
            ))}
            {lowStockIngredients.length === 0 && <div className="empty-state compact">No hay alertas de stock bajo.</div>}
          </div>
        </section>

        <section className="panel recipe-panel">
          <div className="section-title">
            <h2>Receta por plato</h2>
            <span>Costo estimado {money(estimatedCost)}</span>
          </div>
          <select value={selectedMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
            {menuItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <div className="recipe-list">
            {selectedRecipe.map((line) => {
              const ingredient = line.ingredient ?? ingredients.find((item) => item.id === line.ingredientId);
              return (
                <article key={line.id}>
                  <strong>{ingredient?.name ?? 'Ingrediente'}</strong>
                  <span>{line.quantity} {line.unit}</span>
                </article>
              );
            })}
            {selectedRecipe.length === 0 && <div className="empty-state compact">Este plato no tiene receta registrada.</div>}
          </div>
          <form className="inventory-form inline" onSubmit={saveRecipe}>
            <select name="ingredientId">
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
              ))}
            </select>
            <input name="quantity" type="number" min="0.001" step="0.001" placeholder="Cantidad" />
            <select name="unit" defaultValue="gramos">
              <option value="gramos">Gramos</option>
              <option value="kilogramos">Kilogramos</option>
              <option value="mililitros">Mililitros</option>
              <option value="litros">Litros</option>
              <option value="unidad">Unidades</option>
            </select>
            <Button disabled={isSaving || !selectedMenuItemId}>{isSaving ? 'Guardando...' : 'Agregar'}</Button>
          </form>
        </section>

        <section className="panel movements-panel">
          <div className="section-title">
            <h2>Movimientos</h2>
            <span>Entradas, salidas y ajustes</span>
          </div>
          <form className="inventory-form inline" onSubmit={saveMovement}>
            <select name="ingredientId">
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
              ))}
            </select>
            <select name="type" defaultValue="ADJUSTMENT">
              <option value="PURCHASE">Compra</option>
              <option value="CONSUMPTION">Consumo</option>
              <option value="ADJUSTMENT">Ajuste</option>
              <option value="WASTE">Merma</option>
              <option value="RETURN">Devolucion</option>
            </select>
            <input name="quantity" type="number" min="0.001" step="0.001" placeholder="Cantidad" />
            <input name="reason" placeholder="Motivo" />
            <Button disabled={isSaving}>{isSaving ? 'Guardando...' : 'Registrar'}</Button>
          </form>
          <div className="movement-list">
            {movements.map((movement) => (
              <article key={movement.id}>
                <strong>{movement.ingredient?.name ?? ingredients.find((ingredient) => ingredient.id === movement.ingredientId)?.name}</strong>
                <span>{movement.type} · {movement.quantity}</span>
                <em>{movement.reason}</em>
              </article>
            ))}
            {movements.length === 0 && <div className="empty-state compact">No hay movimientos registrados.</div>}
          </div>
        </section>
      </section>
      </main>
    </AuthGate>
  );
}

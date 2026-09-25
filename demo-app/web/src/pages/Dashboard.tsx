import { useEffect, useState } from "react";
import { api } from "../lib/apiClient.js";
import { logout } from "../lib/session.js";

interface Me {
  id: number;
  email: string;
  name: string;
}

interface Order {
  id: number;
  total_cents: number;
  status: string;
  created_at: number;
}

interface CartItem {
  id: number;
  product: string;
  qty: number;
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    Promise.all([
      api<Me>("/me"),
      api<Order[]>("/orders"),
      api<CartItem[]>("/cart"),
    ]).then(([meData, ordersData, cartData]) => {
      setMe(meData);
      setOrders(ordersData);
      setCart(cartData);
    });
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {me && <p>Welcome, {me.name}</p>}
      <button onClick={logout}>Logout</button>

      <h2>Orders</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>${(o.total_cents / 100).toFixed(2)}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cart</h2>
      <ul>
        {cart.map((item) => (
          <li key={item.id}>
            {item.product} × {item.qty}
          </li>
        ))}
      </ul>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../services/api';

export default function ProductsCatalogPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/master/products').then((res) => setProducts(res.data));
  }, []);

  return (
    <AppLayout title="Products & Price List">
      <div className="card">
        <h3 className="card-title">Available Snack Products</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Pack Size</th>
                <th>Selling Price</th>
                <th>GST %</th>
                <th>HSN Code</th>
                <th>Available Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.product_code}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.pack_size}</td>
                  <td>₹{Number(p.selling_price).toFixed(2)}</td>
                  <td>{p.gst_percentage}%</td>
                  <td>{p.hsn_code}</td>
                  <td>{Number(p.current_stock)} packets</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

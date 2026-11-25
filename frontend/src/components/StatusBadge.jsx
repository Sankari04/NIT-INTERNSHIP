import React from 'react';

const STATUS_CLASS = {
  Submitted: 'badge-warning',
  Approved: 'badge-info',
  Invoiced: 'badge-info',
  Dispatched: 'badge-success',
  Rejected: 'badge-danger',
  ACTIVE: 'badge-success',
  CANCELLED: 'badge-danger',
  Normal: 'badge-success',
  'Low Stock': 'badge-danger',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'badge-info';
  return <span className={`badge ${cls}`}>{status}</span>;
}

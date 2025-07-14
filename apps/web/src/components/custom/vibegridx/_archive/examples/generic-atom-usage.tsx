// ====================================
// EXAMPLE: Using VibeGridX with Generic Atom Configuration
// ====================================

import React from 'react';
import { VibeGridX } from '../VibeGridX';
import { createCustomAtomConfig } from '../utils/atom-config-helpers';
import { atom } from 'xstate';
import type { Column } from '../types';

// Example 1: Custom entity with its own atom
// ==========================================

// Define your custom entity type
interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  inStock: boolean;
}

// Create a custom atom for products
const productsAtom = atom<Record<string, Product>>({});

// Define columns for products
const productColumns: Column<Product>[] = [
  {
    id: 'name',
    name: 'Product Name',
    field: 'name',
    type: 'text',
    width: 200
  },
  {
    id: 'price',
    name: 'Price',
    field: 'price',
    type: 'number',
    width: 100,
    format: 'currency'
  },
  {
    id: 'categoryId',
    name: 'Category',
    field: 'categoryId',
    type: 'relationship',
    width: 150,
    relationshipType: 'category'
  },
  {
    id: 'inStock',
    name: 'In Stock',
    field: 'inStock',
    type: 'boolean',
    width: 80
  }
];

// Example component using custom atom
export function ProductsGrid() {
  // Create atom configuration for products
  const productAtomConfig = createCustomAtomConfig(
    'products',
    productsAtom,
    [
      // Add relationship atoms if needed
      // For example, categories atom for the categoryId relationship
    ]
  );
  
  return (
    <VibeGridX
      entityType="product" // Can be any string now
      columns={productColumns}
      atomConfig={productAtomConfig}
      enableSelectionColumn={true}
      height={600}
    />
  );
}

// Example 2: Using multiple atoms for relationships
// =================================================

// Categories atom for relationship resolution
const categoriesAtom = atom<Record<string, { id: string; name: string }>>({});

// Orders atom
interface Order {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  totalPrice: number;
}

const ordersAtom = atom<Record<string, Order>>({});

// Customers atom for relationships
const customersAtom = atom<Record<string, { id: string; name: string; email: string }>>({});

export function OrdersGrid() {
  // Create atom configuration with multiple relationship atoms
  const orderAtomConfig = createCustomAtomConfig(
    'orders',
    ordersAtom,
    [
      {
        key: 'products',
        atom: productsAtom,
        isRelationshipAtom: true
      },
      {
        key: 'customers',
        atom: customersAtom,
        isRelationshipAtom: true
      }
    ]
  );
  
  const orderColumns: Column<Order>[] = [
    {
      id: 'id',
      name: 'Order ID',
      field: 'id',
      type: 'text',
      width: 120
    },
    {
      id: 'productId',
      name: 'Product',
      field: 'productId',
      type: 'relationship',
      width: 200,
      relationshipType: 'product'
    },
    {
      id: 'customerId',
      name: 'Customer',
      field: 'customerId',
      type: 'relationship',
      width: 200,
      relationshipType: 'customer'
    },
    {
      id: 'quantity',
      name: 'Quantity',
      field: 'quantity',
      type: 'number',
      width: 100
    },
    {
      id: 'totalPrice',
      name: 'Total',
      field: 'totalPrice',
      type: 'number',
      width: 120,
      format: 'currency'
    }
  ];
  
  return (
    <VibeGridX
      entityType="order"
      columns={orderColumns}
      atomConfig={orderAtomConfig}
      enableSelectionColumn={true}
      height={600}
    />
  );
}

// Example 3: Using VibeGridX without atoms (external data)
// ========================================================

export function ExternalDataGrid({ data }: { data: any[] }) {
  const columns: Column[] = [
    {
      id: 'name',
      name: 'Name',
      field: 'name',
      type: 'text',
      width: 200
    },
    {
      id: 'value',
      name: 'Value',
      field: 'value',
      type: 'number',
      width: 150
    }
  ];
  
  return (
    <VibeGridX
      entityType="external"
      columns={columns}
      data={data} // Pass data directly without atoms
      enableSelectionColumn={false}
      height={400}
    />
  );
}

// Example 4: Migrating from legacy hardcoded entity types
// ========================================================

import { tasksAtom } from '@/domain/task';
import { projectsAtom } from '@/domain/project';
import { usersAtom } from '@/domain/user';

export function LegacyTaskGrid() {
  // Option 1: Let VibeGridX auto-detect and create config (backward compatible)
  return (
    <VibeGridX
      entityType="task" // Will auto-create atom config
      columns={[]} // Your task columns
      enableSelectionColumn={true}
    />
  );
}

export function MigratedTaskGrid() {
  // Option 2: Explicitly create atom config for more control
  const taskAtomConfig = createCustomAtomConfig(
    'tasks',
    tasksAtom,
    [
      {
        key: 'projects',
        atom: projectsAtom,
        isRelationshipAtom: true
      },
      {
        key: 'users',
        atom: usersAtom,
        isRelationshipAtom: true
      }
    ]
  );
  
  return (
    <VibeGridX
      entityType="task"
      columns={[]} // Your task columns
      atomConfig={taskAtomConfig} // Explicit config
      enableSelectionColumn={true}
    />
  );
}
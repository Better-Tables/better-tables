/**
 * Better Tables Column Builder Demo
 * 
 * This demonstrates the powerful column builder system with fluent API
 * for creating type-safe, declarative table column definitions.
 */

import { createColumnBuilder, validateColumns, quickColumn } from '../packages/core/src/builders';
import type { ReactNode } from 'react';

// Example data types
interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'pending';
  tags: string[];
  score: number;
  priority: 'low' | 'medium' | 'high';
  country: string;
  avatar?: string;
}

// Create a typed column builder
const cb = createColumnBuilder<Contact>();

// ================================
// TEXT COLUMNS
// ================================

const nameColumn = cb.text()
  .id('name')
  .displayName('Full Name')
  .accessor(contact => `${contact.firstName} ${contact.lastName}`)
  .searchable({ debounce: 500 })
  .width(200, 100, 300)
  .build();

const emailColumn = cb.text()
  .id('email')
  .displayName('Email Address')
  .accessor(contact => contact.email)
  .asEmail()
  .searchable()
  .truncate({ maxLength: 30, showTooltip: true })
  .build();

const phoneColumn = cb.text()
  .id('phone')
  .displayName('Phone Number')
  .accessor(contact => contact.phone)
  .asPhone()
  .transform('none')
  .build();

// ================================
// NUMBER COLUMNS
// ================================

const ageColumn = cb.number()
  .id('age')
  .displayName('Age')
  .accessor(contact => contact.age)
  .range(18, 100)
  .format({ useGrouping: false })
  .build();

const scoreColumn = cb.number()
  .id('score')
  .displayName('Score')
  .accessor(contact => contact.score)
  .range(0, 100)
  .precision(1)
  .percentage({ format: 'decimal' })
  .build();

// ================================
// DATE COLUMNS
// ================================

const createdAtColumn = cb.date()
  .id('createdAt')
  .displayName('Created')
  .accessor(contact => contact.createdAt)
  .dateOnly({ format: 'MMM dd, yyyy' })
  .build();

const updatedAtColumn = cb.date()
  .id('updatedAt')
  .displayName('Last Updated')
  .accessor(contact => contact.updatedAt)
  .relative({ style: 'short' })
  .build();

// ================================
// BOOLEAN COLUMNS
// ================================

const isActiveColumn = cb.boolean()
  .id('isActive')
  .displayName('Active')
  .accessor(contact => contact.isActive)
  .activeInactive()
  .booleanFilter()
  .build();

const verifiedColumn = cb.boolean()
  .id('verified')
  .displayName('Verified')
  .accessor(contact => contact.email.includes('@verified.com'))
  .checkbox({ interactive: false })
  .build();

// ================================
// OPTION COLUMNS
// ================================

const statusColumn = cb.option()
  .id('status')
  .displayName('Status')
  .accessor(contact => contact.status)
  .status([
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' },
    { value: 'pending', label: 'Pending', color: 'yellow' },
  ])
  .showBadges({ showColors: true })
  .build();

const priorityColumn = cb.option()
  .id('priority')
  .displayName('Priority')
  .accessor(contact => contact.priority)
  .priority() // Uses predefined priority options
  .build();

const countryColumn = cb.option()
  .id('country')
  .displayName('Country')
  .accessor(contact => contact.country)
  .asyncOptions(async () => {
    // Simulate API call for country options
    return [
      { value: 'us', label: 'United States 🇺🇸' },
      { value: 'ca', label: 'Canada 🇨🇦' },
      { value: 'uk', label: 'United Kingdom 🇬🇧' },
      { value: 'de', label: 'Germany 🇩🇪' },
    ];
  })
  .build();

// ================================
// MULTI-OPTION COLUMNS
// ================================

const tagsColumn = cb.multiOption()
  .id('tags')
  .displayName('Tags')
  .accessor(contact => contact.tags)
  .tags([
    { value: 'vip', label: 'VIP', color: 'purple' },
    { value: 'lead', label: 'Lead', color: 'blue' },
    { value: 'customer', label: 'Customer', color: 'green' },
    { value: 'prospect', label: 'Prospect', color: 'orange' },
  ], { 
    maxTags: 3, 
    allowCreate: true 
  })
  .showBadges({ removable: true })
  .build();

const skillsColumn = cb.multiOption()
  .id('skills')
  .displayName('Skills')
  .accessor(contact => contact.tags.filter(tag => tag.startsWith('skill:')))
  .options([
    { value: 'skill:javascript', label: 'JavaScript' },
    { value: 'skill:typescript', label: 'TypeScript' },
    { value: 'skill:react', label: 'React' },
    { value: 'skill:node', label: 'Node.js' },
  ])
  .displayFormat({ 
    type: 'comma', 
    maxVisible: 2, 
    separator: ' • ' 
  })
  .build();

// ================================
// CUSTOM COLUMNS
// ================================

const avatarColumn = cb.custom<string>('custom')
  .id('avatar')
  .displayName('Avatar')
  .accessor(contact => contact.avatar || '')
  .cellRenderer(({ value, row }): ReactNode => {
    if (!value) return `No Avatar`;
    return `Avatar for ${row.firstName} ${row.lastName}`;
  })
  .sortable(false)
  .filterable(false)
  .width(80)
  .build();

const actionsColumn = cb.custom<void>('custom')
  .id('actions')
  .displayName('Actions')
  .accessor(() => void 0)
  .cellRenderer(({ row }): ReactNode => {
    return `Actions for ${row.firstName} ${row.lastName}`;
  })
  .sortable(false)
  .filterable(false)
  .width(120)
  .build();

// ================================
// COMPLETE COLUMN CONFIGURATION
// ================================

const contactColumns = [
  avatarColumn,
  nameColumn,
  emailColumn,
  phoneColumn,
  ageColumn,
  statusColumn,
  priorityColumn,
  tagsColumn,
  scoreColumn,
  isActiveColumn,
  countryColumn,
  createdAtColumn,
  updatedAtColumn,
  actionsColumn,
];

// ================================
// VALIDATION & UTILITIES
// ================================

// Validate all columns
const validation = validateColumns(contactColumns);
if (!validation.valid) {
  console.error('Column validation errors:', validation.errors);
} else {
  console.log('✅ All columns are valid!');
  console.log(`📊 Total columns: ${contactColumns.length}`);
}

// ================================
// QUICK COLUMN EXAMPLES
// ================================

// For rapid prototyping, use quick columns
const quickColumns = [
  quickColumn<Contact, string>('firstName', 'First Name', c => c.firstName),
  quickColumn<Contact, string>('lastName', 'Last Name', c => c.lastName),
  quickColumn<Contact, number>('age', 'Age', c => c.age, { type: 'number', width: 80 }),
  quickColumn<Contact, boolean>('isActive', 'Active', c => c.isActive, { type: 'boolean' }),
];

// ================================
// USAGE EXAMPLE
// ================================

// Example of how these columns would be used with actual data
const sampleContacts: Contact[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    age: 32,
    isActive: true,
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2024-01-10'),
    status: 'active',
    tags: ['vip', 'customer', 'skill:javascript'],
    score: 85,
    priority: 'high',
    country: 'us',
    avatar: 'https://example.com/avatar1.jpg',
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@verified.com',
    phone: '+1-555-0124',
    age: 28,
    isActive: false,
    createdAt: new Date('2023-03-20'),
    updatedAt: new Date('2024-01-08'),
    status: 'inactive',
    tags: ['lead', 'prospect'],
    score: 72,
    priority: 'medium',
    country: 'ca',
  },
];

// Test accessor functions with real data
const testAccessors = () => {
  const contact = sampleContacts[0];
  
  console.log('Testing column accessors:');
  console.log('Name:', nameColumn.accessor(contact));
  console.log('Email:', emailColumn.accessor(contact));
  console.log('Age:', ageColumn.accessor(contact));
  console.log('Status:', statusColumn.accessor(contact));
  console.log('Tags:', tagsColumn.accessor(contact));
  console.log('Is Active:', isActiveColumn.accessor(contact));
};

// ================================
// ADVANCED CONFIGURATION EXAMPLES
// ================================

// Column with complex filtering and validation
const advancedEmailColumn = cb.text()
  .id('businessEmail')
  .displayName('Business Email')
  .accessor(contact => contact.email)
  .asEmail()
  .searchable({
    debounce: 1000,
    validation: (value) => {
      if (value.includes('@gmail.com')) {
        return 'Business emails only (no @gmail.com)';
      }
      return true;
    }
  })
  .validation([
    {
      id: 'email-format',
      validate: (email) => email.includes('@'),
      message: 'Must be a valid email address'
    },
    {
      id: 'business-email',
      validate: (email) => !email.includes('@gmail.com'),
      message: 'Business emails only'
    }
  ])
  .cellRenderer(({ value, row }): ReactNode => {
    const verified = value.includes('@verified.com') ? ' ✓' : '';
    return `${value}${verified}`;
  })
  .build();

// Export for use in applications
export {
  contactColumns,
  quickColumns,
  advancedEmailColumn,
  sampleContacts,
  testAccessors,
  validation,
};

// ================================
// TYPE SAFETY DEMONSTRATION
// ================================

// The TypeScript compiler will catch errors like:

// ❌ This would cause a TypeScript error:
// const errorColumn = cb.text()
//   .id('invalid')
//   .displayName('Invalid')
//   .accessor(contact => contact.nonExistentProperty) // TS Error!
//   .build();

// ❌ This would also cause an error:
// const anotherErrorColumn = cb.number()
//   .id('age')
//   .displayName('Age')
//   .accessor(contact => contact.email) // TS Error: string is not assignable to number
//   .build();

// ✅ This is type-safe and correct:
const typeSafeColumn = cb.text()
  .id('fullName')
  .displayName('Full Name')
  .accessor(contact => `${contact.firstName} ${contact.lastName}`) // ✓ Returns string
  .build();

console.log('🎉 Column Builder Demo Complete!');
console.log('📝 Check the contactColumns array for the complete configuration');
console.log('🧪 Run testAccessors() to see the columns in action'); 
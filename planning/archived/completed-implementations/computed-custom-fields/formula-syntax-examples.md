# Formula Syntax Examples - Computed Custom Fields

## 🧮 **Basic Mathematical Operations**

### **Arithmetic Operations**
```javascript
// Addition
{price} + {tax}

// Subtraction  
{revenue} - {costs}

// Multiplication
{quantity} * {unitPrice}

// Division
{totalScore} / {numberOfTests}

// Percentage
{completedTasks} / {totalTasks} * 100

// Modulo (remainder)
{totalItems} % {itemsPerBox}

// Exponentiation
{base} ^ {exponent}
```

### **Order of Operations**
```javascript
// Parentheses for grouping
({revenue} - {costs}) / {revenue} * 100

// Complex calculations
({hours} * {rate}) + ({hours} > 40 ? ({hours} - 40) * {overtimeRate} : 0)

// Multiple operations
{length} * {width} * {height} / 1000
```

## 📊 **Business Logic Examples**

### **Financial Calculations**
```javascript
// Profit Margin
({revenue} - {cost}) / {revenue} * 100

// Total with Tax
{subtotal} * (1 + {taxRate} / 100)

// Discount Amount
{originalPrice} * {discountPercent} / 100

// Net Present Value (simplified)
{futureValue} / (1 + {interestRate}) ^ {years}

// Break-even Point
{fixedCosts} / ({sellingPrice} - {variableCost})
```

### **Project Management**
```javascript
// Progress Percentage
{completedTasks} / {totalTasks} * 100

// Velocity (points per sprint)
{storyPointsCompleted} / {sprintDuration}

// Efficiency Ratio
{actualHours} > 0 ? {estimatedHours} / {actualHours} * 100 : 0

// Burn Rate (budget consumed per day)
{budgetSpent} / {daysElapsed}

// Time Remaining (in days)
({totalBudget} - {budgetSpent}) / {dailyBurnRate}
```

### **Sales & Marketing**
```javascript
// Conversion Rate
{conversions} / {visitors} * 100

// Customer Acquisition Cost
{marketingSpend} / {newCustomers}

// Average Order Value
{totalRevenue} / {numberOfOrders}

// Customer Lifetime Value (simplified)
{averageOrderValue} * {purchaseFrequency} * {customerLifespan}

// Return on Investment
({gain} - {investment}) / {investment} * 100
```

## 🔧 **Advanced Formula Features**

### **Conditional Logic** (If supported)
```javascript
// Simple condition
{quantity} > 10 ? {quantity} * 0.9 : {quantity}

// Multiple conditions
{status} == "premium" ? {price} * 0.8 : 
{status} == "standard" ? {price} * 0.9 : 
{price}

// Range-based pricing
{quantity} >= 100 ? {basePrice} * 0.7 :
{quantity} >= 50 ? {basePrice} * 0.8 :
{quantity} >= 10 ? {basePrice} * 0.9 :
{basePrice}
```

### **Null/Zero Handling**
```javascript
// Avoid division by zero
{denominator} != 0 ? {numerator} / {denominator} : 0

// Handle missing values
{value} || 0

// Percentage with fallback
{total} > 0 ? {completed} / {total} * 100 : 0
```

### **Mathematical Functions** (If supported)
```javascript
// Rounding
round({value} * 100) / 100

// Absolute value
abs({profit})

// Minimum/Maximum
max({value1}, {value2})
min({cost1}, {cost2})

// Square root
sqrt({area})

// Power
pow({base}, {exponent})
```

## 🏷️ **Field Reference Syntax Options**

### **Option 1: Curly Braces** (Recommended)
```javascript
{fieldName}
{unit_price}
{totalTasks}
```

### **Option 2: Square Brackets**
```javascript
[fieldName]
[unit_price]
[totalTasks]
```

### **Option 3: @ Symbol**
```javascript
@fieldName
@unit_price
@totalTasks
```

### **Option 4: Dot Notation**
```javascript
.fieldName
.unit_price
.totalTasks
```

## ⚠️ **Error Handling Examples**

### **Common Error Scenarios**
```javascript
// Division by zero
{revenue} / {costs}  // Error if costs = 0

// Solution with error handling
{costs} != 0 ? {revenue} / {costs} : 0

// Missing field reference
{nonExistentField} * 2  // Error: Field not found

// Invalid syntax
{price} * * {quantity}  // Syntax error

// Circular reference
// Field A: {fieldB} + 1
// Field B: {fieldA} + 1  // Error: Circular dependency
```

### **Validation Messages**
```
❌ Division by zero: Check that {denominator} is not zero
❌ Field not found: {fieldName} does not exist
❌ Syntax error: Invalid expression near "*"
❌ Circular dependency: Field references create a loop
❌ Type mismatch: {textField} is not numeric
```

## 📝 **Formula Creation UI Examples**

### **Simple Formula Builder**
```
Formula: {unitPrice} * {quantity}

Available Fields:
- unitPrice (number)
- quantity (number) 
- discount (number)
- taxRate (number)

Preview: $150.00 (based on sample data)
```

### **Advanced Formula Editor**
```
Formula Editor
┌─────────────────────────────────────────┐
│ ({revenue} - {costs}) / {revenue} * 100 │
└─────────────────────────────────────────┘

Functions: + - * / % ^ ( ) 
Conditions: ? : == != > < >= <=

Field Picker:
☑ revenue ($50,000)
☑ costs ($35,000)  
☐ profit ($15,000)
☐ taxRate (8.5%)

Preview: 30% (profit margin)
```

## 🧪 **Testing Scenarios**

### **Basic Calculations**
- Simple arithmetic operations
- Order of operations with parentheses
- Percentage calculations
- Division by zero handling

### **Business Logic**
- Financial formulas with real data
- Project management calculations
- Sales metrics computation
- Complex multi-step formulas

### **Edge Cases**
- Null/undefined field values
- Very large numbers
- Very small decimal values
- Circular dependency detection
- Invalid field references

### **Performance**
- Formulas with many field references
- Complex nested calculations
- Real-time updates with many dependencies
- Large datasets with computed fields

---

*These examples provide a foundation for designing the formula syntax and capabilities for computed custom fields.*
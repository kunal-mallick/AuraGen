export const FIELDS = [
  { name: 'fullName', label: 'Full legal name', type: 'text', hint: 'Exactly as on your PAN card', pattern: '^[A-Za-z .]{3,}$', error: 'Letters only, at least 3 characters' },
  { name: 'pan', label: 'PAN number', type: 'text', hint: '10 characters, e.g. ABCDE1234F', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', error: 'PAN is 5 capital letters, 4 digits, 1 capital letter' },
  { name: 'employment', label: 'Employment type', type: 'select', options: ['Salaried', 'Self-employed', 'Business owner'], hint: 'Pick what best matches your main income' },
  { name: 'income', label: 'Annual income (INR)', type: 'number', hint: 'Gross, before tax' },
  { name: 'loanAmount', label: 'Loan amount (INR)', type: 'number', hint: 'Between 50,000 and 50,00,000', pattern: '^([5-9][0-9]{4}|[1-9][0-9]{5,6}|[1-4][0-9]{6}|5000000)$', error: 'Enter 50000 to 5000000 without commas' },
  { name: 'tenure', label: 'Tenure (months)', type: 'number', hint: '12 to 84 months', pattern: '^(1[2-9]|[2-7][0-9]|8[0-4])$', error: 'Enter 12 to 84' },
];

export interface Sheet {
  id: string;
  render: (close: () => void) => React.ReactNode;
  kind: 'sheet' | 'center';
  locked: boolean;
}
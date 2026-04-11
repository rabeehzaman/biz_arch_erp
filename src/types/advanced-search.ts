export type TextField = {
  type: "text";
  key: string;
  labelKey: string;
};

export type DateRangeField = {
  type: "dateRange";
  key: string;
  labelKey: string;
  fromKey: string;
  toKey: string;
};

export type NumberRangeField = {
  type: "numberRange";
  key: string;
  labelKey: string;
  fromKey: string;
  toKey: string;
};

export type SelectField = {
  type: "select";
  key: string;
  labelKey: string;
  options: { value: string; labelKey: string }[];
};

export type ComboboxField = {
  type: "combobox";
  key: string;
  labelKey: string;
  entityUrl: string;
};

export type AdvancedSearchField =
  | TextField
  | DateRangeField
  | NumberRangeField
  | SelectField
  | ComboboxField;

export type AdvancedSearchValues = Record<string, string>;

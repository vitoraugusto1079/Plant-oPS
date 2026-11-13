INSERT INTO medications (name, max_dose, unit, default_route) VALUES
  ('Dipirona', 1000.00, 'mg', 'Intravenosa (EV)'),
  ('Paracetamol', 1000.00, 'mg', 'Oral'),
  ('Morfina', 10.00, 'mg', 'Intravenosa (EV)'),
  ('Tramadol', 100.00, 'mg', 'Intravenosa (EV)'),
  ('Amoxicilina', 875.00, 'mg', 'Oral'),
  ('Ceftriaxona', 2000.00, 'mg', 'Intravenosa (EV)'),
  ('Diazepam', 10.00, 'mg', 'Intravenosa (EV)'),
  ('Fentanil', 100.00, 'mcg', 'Intravenosa (EV)'),
  ('Ondansetrona', 8.00, 'mg', 'Intravenosa (EV)'),
  ('Cetoprofeno', 100.00, 'mg', 'Intravenosa (EV)'),
  ('Insulina Regular', 20.00, 'UI', 'Subcutânea (SC)')
ON CONFLICT (name) DO UPDATE
SET max_dose = EXCLUDED.max_dose,
    unit = EXCLUDED.unit,
    default_route = EXCLUDED.default_route;

INSERT INTO beds (name, ward, status) VALUES
  ('Leito Vermelho 01', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 02', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 03', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 04', 'Sala Vermelha', 'livre'),
  ('Leito Observação 01', 'Observação', 'livre'),
  ('Leito Observação 02', 'Observação', 'livre'),
  ('Leito Observação 03', 'Observação', 'livre'),
  ('Leito Observação 04', 'Observação', 'livre'),
  ('Leito Observação 05', 'Observação', 'livre'),
  ('Leito Observação 06', 'Observação', 'livre')
ON CONFLICT DO NOTHING;

INSERT INTO patients (id, name, birth_date, gender, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'João da Silva Sauro', '1952-04-10', 'M', '(11) 98765-4321'),
  ('22222222-2222-2222-2222-222222222222', 'Mariana Oliveira Santos', '2019-08-15', 'F', '(11) 97654-3210'),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Eduardo Lima', '1990-11-20', 'M', '(11) 96543-2109'),
  ('44444444-4444-4444-4444-444444444444', 'Ana Paula Ferreira', '1985-03-30', 'F', '(11) 95432-1098'),
  ('55555555-5555-5555-5555-555555555555', 'Roberto Mendes Costa', '1945-09-05', 'M', '(11) 94321-0987')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patient_allergies (patient_id, allergen_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dipirona'),
  ('22222222-2222-2222-2222-222222222222', 'Amoxicilina'),
  ('33333333-3333-3333-3333-333333333333', 'Morfina')
ON CONFLICT DO NOTHING;

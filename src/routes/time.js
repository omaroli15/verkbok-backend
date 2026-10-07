const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function mapDocumentRow(row) {
  return {
    ...row,
    items: row.items || []
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
              COALESCE(
                json_agg(di ORDER BY di.created_at ASC)
                FILTER (WHERE di.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM documents d
       LEFT JOIN document_items di ON di.document_id = d.id
       WHERE d.company_id = $1
       GROUP BY d.id
       ORDER BY d.updated_at DESC`,
      [req.user.company_id]
    );

    res.json(result.rows.map(mapDocumentRow));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
              COALESCE(
                json_agg(di ORDER BY di.created_at ASC)
                FILTER (WHERE di.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM documents d
       LEFT JOIN document_items di ON di.document_id = d.id
       WHERE d.company_id = $1 AND d.id = $2
       GROUP BY d.id`,
      [req.user.company_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json(mapDocumentRow(result.rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch document', error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      type,
      number,
      title,
      date,
      customer,
      items = [],
      discount = 0,
      vat = 24,
      days = 30,
      men = 1,
      notes = '',
      reference = ''
    } = req.body;

    if (!type || !['tilbod', 'reikningur'].includes(type)) {
      return res.status(400).json({ message: 'Document type must be tilbod or reikningur' });
    }

    const docData = {
      type,
      number: number || `${type === 'tilbod' ? 'T' : 'R'}-${Date.now()}`,
      title: title || '',
      documentDate: date || new Date().toISOString().slice(0, 10),
      customerName: customer?.name || '',
      customerKt: customer?.kt || '',
      customerEmail: customer?.email || '',
      customerAddress: customer?.address || '',
      discount,
      vat,
      days,
      men,
      notes,
      reference
    };

    const documentResult = await pool.query(
      `INSERT INTO documents (
        company_id, user_id, type, number, document_date, title,
        customer_name, customer_kt, customer_email, customer_address,
        discount, vat, days, men, notes, reference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        req.user.company_id,
        req.user.id,
        docData.type,
        docData.number,
        docData.documentDate,
        docData.title,
        docData.customerName,
        docData.customerKt,
        docData.customerEmail,
        docData.customerAddress,
        Number(docData.discount || 0),
        Number(docData.vat || 24),
        Number(docData.days || 30),
        Number(docData.men || 1),
        docData.notes,
        docData.reference
      ]
    );

    const document = documentResult.rows[0];

    if (Array.isArray(items) && items.length > 0) {
      const itemInsertValues = items.map((item) => [
        document.id,
        item.kind || 'vinna',
        item.desc || '',
        Number(item.qty || 0),
        item.unit || 'klst.',
        Number(item.price || 0),
        Number(item.hpu || 0)
      ]);

      const itemQuery = `
        INSERT INTO document_items (document_id, kind, description, qty, unit, unit_price, hours_per_unit)
        VALUES %L
      `;

      const formattedValues = itemInsertValues.map((row) => `('${row[0]}', '${row[1]}', '${String(row[2]).replace(/'/g, "''")}', ${row[3]}, '${row[4]}', ${row[5]}, ${row[6]})`).join(', ');
      await pool.query(`INSERT INTO document_items (document_id, kind, description, qty, unit, unit_price, hours_per_unit) VALUES ${formattedValues}`);
    }

    const finalResult = await pool.query(
      `SELECT d.*,
              COALESCE(
                json_agg(di ORDER BY di.created_at ASC)
                FILTER (WHERE di.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM documents d
       LEFT JOIN document_items di ON di.document_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [document.id]
    );

    return res.status(201).json(mapDocumentRow(finalResult.rows[0]));
  } catch (error) {
    console.error('Create document error:', error);
    return res.status(500).json({ message: 'Failed to create document', error: error.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { items = [], ...rest } = req.body;

    const row = await pool.query(
      `SELECT * FROM documents WHERE company_id = $1 AND id = $2`,
      [req.user.company_id, req.params.id]
    );

    if (!row.rows[0]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const fields = [];
    const values = [req.user.company_id, req.params.id];
    let index = 3;

    Object.entries(rest).forEach(([key, value]) => {
      if (value === undefined) return;
      const column = key === 'customer' ? 'customer_name' : key;
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    });

    if (fields.length) {
      await pool.query(
        `UPDATE documents SET ${fields.join(', ')}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
        values
      );
    }

    if (Array.isArray(items) && items.length > 0) {
      await pool.query('DELETE FROM document_items WHERE document_id = $1', [req.params.id]);

      const inserts = items.map((item) => (
        `('${req.params.id}', '${item.kind || 'vinna'}', '${String(item.desc || '').replace(/'/g, "''")}', ${Number(item.qty || 0)}, '${item.unit || 'klst.'}', ${Number(item.price || 0)}, ${Number(item.hpu || 0)})`
      )).join(', ');

      if (inserts) {
        await pool.query(`INSERT INTO document_items (document_id, kind, description, qty, unit, unit_price, hours_per_unit) VALUES ${inserts}`);
      }
    }

    const finalResult = await pool.query(
      `SELECT d.*,
              COALESCE(
                json_agg(di ORDER BY di.created_at ASC)
                FILTER (WHERE di.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM documents d
       LEFT JOIN document_items di ON di.document_id = d.id
       WHERE d.company_id = $1 AND d.id = $2
       GROUP BY d.id`,
      [req.user.company_id, req.params.id]
    );

    return res.json(mapDocumentRow(finalResult.rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update document', error: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM documents WHERE company_id = $1 AND id = $2 RETURNING *',
      [req.user.company_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document', error: error.message });
  }
});

module.exports = router;

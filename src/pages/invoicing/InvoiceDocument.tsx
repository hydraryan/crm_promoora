import { formatINR, type Invoice } from '@/utils/invoiceConstants'

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <div className="bg-white" style={{ fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}>
      <div style={{ padding: '40px 48px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 26, fontWeight: 300, color: '#222' }}>Promo</span>
            <span style={{ fontSize: 26, fontWeight: 300, color: 'rgba(77,127,255,0.5)' }}>[</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#A855F7' }}>ora</span>
            <span style={{ fontSize: 26, fontWeight: 300, color: 'rgba(77,127,255,0.5)' }}>]</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Chandigarh, India</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>info@promoora.in</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, color: '#111', letterSpacing: '-0.5px', marginBottom: 14 }}>Invoice</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: '#777' }}>Invoice: {invoice.invoiceNumber}</span>
            <span style={{ fontSize: 12, color: '#777' }}>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
            <span style={{ fontSize: 12, color: '#777' }}>Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #f5f5f5' }}>
        <div style={{ padding: '28px 48px', borderRight: '1px solid #f5f5f5' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#bbb', marginBottom: 12 }}>From</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>Promoora</p>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>Sector 17, Chandigarh</p>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>Punjab, India - 160017</p>
        </div>
        <div style={{ padding: '28px 48px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#bbb', marginBottom: 12 }}>Bill To</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>{invoice.client.businessName}</p>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{invoice.client.ownerName}</p>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{invoice.client.phone}</p>
          {invoice.client.email && <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{invoice.client.email}</p>}
          {invoice.client.address && <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{invoice.client.address}</p>}
        </div>
      </div>

      <div style={{ padding: '32px 48px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: 10, fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Description</th>
              <th style={{ textAlign: 'right', paddingBottom: 10, fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Qty</th>
              <th style={{ textAlign: 'right', paddingBottom: 10, fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Rate</th>
              <th style={{ textAlign: 'right', paddingBottom: 10, fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: '10px 0', borderTop: '1px solid #f5f5f5' }}>
                  <p style={{ fontSize: 13, color: '#222' }}>{item.description}</p>
                  {item.subDescription && <p style={{ marginTop: 2, fontSize: 11, color: '#888' }}>{item.subDescription}</p>}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 0', borderTop: '1px solid #f5f5f5', fontSize: 13, color: '#444', fontFamily: 'monospace' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', padding: '10px 0', borderTop: '1px solid #f5f5f5', fontSize: 13, color: '#444', fontFamily: 'monospace' }}>{formatINR(item.rate)}</td>
                <td style={{ textAlign: 'right', padding: '10px 0', borderTop: '1px solid #f5f5f5', fontSize: 13, color: '#111', fontFamily: 'monospace' }}>{formatINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '0 48px 32px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderBottom: '0.5px solid #f5f5f5' }}>
            <span style={{ color: '#555' }}>Subtotal</span>
            <span style={{ color: '#333', fontFamily: 'monospace' }}>{formatINR(invoice.subtotal)}</span>
          </div>
          {invoice.gstEnabled && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderBottom: '0.5px solid #f5f5f5' }}>
              <span style={{ color: '#555' }}>GST (18%)</span>
              <span style={{ color: '#A855F7', fontFamily: 'monospace' }}>{formatINR(invoice.gstAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', borderTop: '1.5px solid #111', marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Total Due</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>{formatINR(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 48px', borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#bbb', marginBottom: 12 }}>Payment Details</p>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>Account holder: Mr. Aryan Rajput</p>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>Account number: 39338156036</p>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>IFSC: SBIN0011220</p>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>UPI: 9627277003-2@ibl</p>
      </div>

      {invoice.notes && (
        <div style={{ padding: '24px 48px', borderBottom: '1px solid #f5f5f5' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#bbb', marginBottom: 10 }}>Notes</p>
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.75 }}>{invoice.notes}</p>
        </div>
      )}

      <div style={{ background: '#080810', padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: '#999' }}>Promoora</span>
        <span style={{ fontSize: 11, color: '#444' }}>Chandigarh, India - info@promoora.in</span>
        <span style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>Thank you for your trust.</span>
      </div>
    </div>
  )
}

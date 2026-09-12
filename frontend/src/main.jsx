import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, ShoppingCart, Upload, ShieldCheck, Package, HeartPulse,
  LogIn, UserRound, ClipboardCheck, ArrowRight, Clock3, ChevronLeft,
  ChevronRight, SlidersHorizontal
} from 'lucide-react';
import './style.css';

const API = 'http://localhost:5000/api';
const PAGE_SIZE = 24;

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('pf_user') || 'null'));
  const [token, setToken] = useState(localStorage.getItem('pf_token'));
  const [authMode, setAuthMode] = useState('login');
  const [page, setPage] = useState('home');
  const [meds, setMeds] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('relevance');
  const [rxOnly, setRxOnly] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [cart, setCart] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('pf_user') || 'null');
      const key = storedUser?.id ? `pf_cart_${storedUser.id}` : 'pf_cart';
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const key = user?.id ? `pf_cart_${user.id}` : 'pf_cart';
    localStorage.setItem(key, JSON.stringify(cart));
  }, [cart, user]);
  const [notice, setNotice] = useState('');
  const [medicinesLoading, setMedicinesLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [address, setAddress] = useState('Demo Address, Hyderabad');

  const logout = () => {
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user');
    // Keep pf_cart_<userId> so the customer gets the cart back after signing in again.
    localStorage.removeItem('pf_prescription_id');
    if (user?.id) localStorage.removeItem(`pf_prescription_id_${user.id}`);
    setToken(null);
    setUser(null);
    setCart([]);
    setPage('home');
    setNotice('Signed out successfully');
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;
    setMedicinesLoading(true);
    fetch(`${API}/medicines`)
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Medicine request failed');
        return data;
      })
      .then(data => {
        if (active) setMeds(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setNotice('Unable to load medicines. Please start the backend on port 5000.');
      })
      .finally(() => {
        if (active) setMedicinesLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCatalogPage(1);
  }, [q, category, sort, rxOnly]);

  const visibleMeds = useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered = meds
      .filter(m => m.active !== 0)
      .filter(m => m.image_url && String(m.image_url).trim())
      .filter(m => category === 'All' || m.category === category)
      .filter(m => !rxOnly || Number(m.prescription_required) === 1)
      .filter(m => {
        if (!term) return true;
        return [
          m.name,
          m.generic_name,
          m.manufacturer,
          m.category,
          m.description
        ].filter(Boolean).join(' ').toLowerCase().includes(term);
      });

    return [...filtered].sort((a, b) => {
      if (sort === 'price-low') return Number(a.price) - Number(b.price);
      if (sort === 'price-high') return Number(b.price) - Number(a.price);
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'stock') return Number(b.stock || 0) - Number(a.stock || 0);
      return Number(a.id) - Number(b.id);
    });
  }, [meds, q, category, sort, rxOnly]);

  const featured = visibleMeds.slice(0, 8);
  const totalPages = Math.max(1, Math.ceil(visibleMeds.length / PAGE_SIZE));
  const pageItems = visibleMeds.slice(
    (catalogPage - 1) * PAGE_SIZE,
    catalogPage * PAGE_SIZE
  );

  const categories = useMemo(() => {
    return ['All', ...Array.from(
      new Set(
        meds
          .filter(m => m.image_url && String(m.image_url).trim())
          .map(m => m.category)
          .filter(Boolean)
      )
    ).sort()];
  }, [meds]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
    [cart]
  );

  function go(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function add(m) {
    setCart(current => {
      const found = current.find(x => x.id === m.id);
      const stock = Number(m.stock || 0);

      if (found) {
        if (found.qty >= stock) {
          setNotice(`Only ${stock} unit(s) of ${m.name} are available`);
          return current;
        }
        return current.map(x => x.id === m.id ? { ...x, qty: x.qty + 1 } : x);
      }

      if (stock <= 0) {
        setNotice(`${m.name} is currently unavailable`);
        return current;
      }

      return [...current, { ...m, qty: 1 }];
    });
    setNotice(`${m.name} added to cart`);
    setTimeout(() => setNotice(''), 1800);
  }

  function changeQty(id, delta) {
    setCart(current => current
      .map(item => {
        if (item.id !== id) return item;
        const next = item.qty + delta;
        const stock = Number(item.stock || 0);
        if (next <= 0) return null;
        if (next > stock) {
          setNotice(`Only ${stock} unit(s) are available`);
          return item;
        }
        return { ...item, qty: next };
      })
      .filter(Boolean)
    );
  }

  function removeFromCart(id) {
    setCart(current => current.filter(item => item.id !== id));
    setNotice('Item removed from cart');
  }

  async function register(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name');
    const email = fd.get('email');
    const password = fd.get('password');
    const confirm = fd.get('confirm');

    if (password !== confirm) {
      setNotice('Passwords do not match');
      return;
    }

    let r;
    try {
      r = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
    } catch {
      setNotice('Unable to reach the backend. Please try again.');
      return;
    }

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      setNotice(d.error || 'Registration failed');
      return;
    }

    setNotice('Account created. Please sign in.');
    setAuthMode('login');
  }
  async function login(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    let r;
    try {
      r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'),
          password: fd.get('password')
        })
      });
    } catch {
      setNotice('Unable to reach the backend. Please make sure port 5000 is running.');
      return;
    }

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      setNotice(d.error || 'Login failed');
      return;
    }

    localStorage.setItem('pf_token', d.token);
    localStorage.setItem('pf_user', JSON.stringify(d.user));
    setToken(d.token);
    setUser(d.user);
    try {
      setCart(JSON.parse(localStorage.getItem(`pf_cart_${d.user.id}`) || '[]'));
    } catch { setCart([]); }
    localStorage.removeItem('pf_cart');
      setNotice('');
    setNotice('Signed in successfully');
    go('home');
  }

  useEffect(() => {
    if (!token) {
      setPrescriptions([]);
      return;
    }

    fetch(`${API}/prescriptions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async r => {
        const d = await r.json().catch(() => []);
        if (!r.ok) throw new Error(d.error || 'Unable to load prescriptions');
        return d;
      })
      .then(d => setPrescriptions(Array.isArray(d) ? d : []))
      .catch(() => setPrescriptions([]));
  }, [token]);

  async function uploadRx(e) {
    e.preventDefault();

    if (!token) {
      setNotice('Please sign in before uploading a prescription');
      return;
    }

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const r = await fetch(`${API}/prescriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: fd
      });

      const d = await r.json();

      if (!r.ok) {
        setNotice(d.error || 'Prescription upload failed');
        return;
      }

      localStorage.setItem('pf_prescription_id', String(d.id));
      if (user?.id) localStorage.setItem(`pf_prescription_id_${user.id}`, String(d.id));
      setPrescriptions(current => [{
        id: d.id,
        user_id: user.id,
        file_name: d.fileName || fd.get('prescription')?.name || 'prescription',
        ocr_text: d.ocr?.text || '',
        status: d.status || 'PENDING',
        created_at: new Date().toISOString()
      }, ...current]);

      setNotice(
        `Prescription #${d.id} uploaded | OCR confidence ${Math.round((d.ocr?.confidence ?? 0) * 100)}% | Awaiting pharmacist review`
      );

      form.reset();
    } catch (err) {
      setNotice('Unable to upload prescription. Please check the backend.');
    }
  }

  async function checkout() {
    if (!user || !token) {
      setNotice('Please sign in to checkout');
      return;
    }

    if (!cart.length) {
      setNotice('Your cart is empty');
      return;
    }

    const prescriptionRequired = cart.some(
      x => Number(x.prescription_required) === 1
    );

    const storedPrescriptionId =
      (user?.id && localStorage.getItem(`pf_prescription_id_${user.id}`)) ||
      localStorage.getItem('pf_prescription_id');

    const approvedPrescription = prescriptions.find(p => String(p.status).toUpperCase() === 'APPROVED');
    const prescriptionId = approvedPrescription?.id || storedPrescriptionId;

    if (prescriptionRequired && !approvedPrescription && !storedPrescriptionId) {
      setNotice('An approved prescription is required for this cart');
      go('rx');
      return;
    }

    if (prescriptionRequired && prescriptions.length &&
        !approvedPrescription) {
      setNotice('Your prescription is uploaded but not approved yet. Please wait for pharmacist approval.');
      go('rx');
      return;
    }

    try {
      const r = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(x => ({
            medicineId: x.id,
            quantity: x.qty
          })),
          address,
          prescriptionId: prescriptionRequired ? Number(prescriptionId) : null,
          paymentMethod: 'COD'
        })
      });

      const d = await r.json();

      if (r.ok) {
        setCart([]);
        localStorage.removeItem('pf_prescription_id');
        if (user?.id) localStorage.removeItem(`pf_prescription_id_${user.id}`);
        setPrescriptions([]);
        setNotice(`Order #${d.orderId} confirmed successfully`);
        go('orders');
      } else {
        setNotice(d.error || 'Checkout failed');
      }
    } catch (err) {
      setNotice('Unable to reach the server. Please try again.');
    }
  }

  return (
    <div>
      <header>
        <div className="brand" onClick={() => go('home')}>
          <div className="logo">+</div>
          <div>
            Pharma<span>Flow</span>
            <small>CARE | TRUST | DELIVERY</small>
          </div>
        </div>

        <nav>
          <button onClick={() => go('home')}>Home</button>
          <button onClick={() => go('medicines')}>Medicines</button>
          <button onClick={() => go('rx')}>Prescription</button>
          <button onClick={() => go('orders')}>Orders</button>
          {user && user.role !== 'CUSTOMER' && (
            <button onClick={() => go('admin')}>Pharmacist</button>
          )}
        </nav>

        <div className="actions">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Search medicines..."
              value={q}
              onChange={e => {
                setQ(e.target.value);
                if (page !== 'medicines') setPage('medicines');
              }}
            />
          </div>

          <button className="icon" onClick={() => go('cart')}>
            <ShoppingCart />
            {cart.reduce((n, x) => n + x.qty, 0) > 0 && <b>{cart.reduce((n, x) => n + x.qty, 0)}</b>}
          </button>

          {user ? (
            <>
              <button className="user" onClick={() => go('profile')}>
                <UserRound size={17} />
                {user.name.split(' ')[0]}
              </button>
              <button className="primary logoutBtn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => go('login')}>
              <LogIn size={17} />
              Sign in
            </button>
          )}
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      {page === 'home' && (
        <>
          <section className="hero">
            <div>
              <label>PRESCRIPTION-AWARE PHARMACY PLATFORM</label>
              <h1>
                Healthcare, delivered<br />
                <em>with confidence.</em>
              </h1>
              <p>
                Browse verified product listings, upload prescriptions for
                OCR-assisted processing, and manage orders in one secure
                academic pharmacy platform.
              </p>
              <button className="heroBtn" onClick={() => go('medicines')}>
                Explore medicines <ArrowRight />
              </button>
            </div>

            <div className="heroCard">
              <ShieldCheck size={42} />
              <h3>Prescription protected</h3>
              <p>
                OCR-assisted extraction followed by pharmacist review before
                restricted medicines can be purchased.
              </p>
              <div className="metric">
                <strong>Secure</strong>
                <span>Order management</span>
              </div>
            </div>
          </section>

          <section className="trust">
            <div><ShieldCheck /> Secure workflow</div>
            <div><ClipboardCheck /> Pharmacist verification</div>
            <div><Clock3 /> Clear order status</div>
            <div><Package /> Order management</div>
          </section>

          <section className="catalog" id="catalog">
            <div className="sectionHead">
              <div>
                <label>FEATURED PRODUCTS</label>
                <h2>Shop selected medicines</h2>
              </div>
              <button className="textBtn" onClick={() => go('medicines')}>
                View all medicines <ArrowRight size={16} />
              </button>
            </div>

            {featured.length ? (
              <div className="grid">
                {featured.map(m => (
                  <ProductCard key={m.id} medicine={m} onAdd={add} />
                ))}
              </div>
            ) : (
              <div className="empty">
                Product imagery is being verified. Customer-facing listings
                will appear here only when a product image is available.
              </div>
            )}
          </section>

          <section className="content homeInfo">
            <div className="panel">
              <label>HOW IT WORKS</label>
              <h2>From prescription to order</h2>
              <div className="flow">
                <span>01 Browse</span>
                <span>02 Upload Rx</span>
                <span>03 OCR</span>
                <span>04 Pharmacist</span>
                <span>05 Checkout</span>
              </div>
            </div>
          </section>
        </>
      )}

      {page === 'medicines' && (
        <main className="content">
          <div className="catalogTop">
            <div>
              <label>MEDICINE CATALOG</label>
              <h2>Browse medicines</h2>
              <p>
                Search, filter and sort the catalog like a modern pharmacy marketplace.
                Products without customer-ready imagery stay hidden from the storefront.
              </p>
            </div>
            <strong>{visibleMeds.length} products</strong>
          </div>

          <div className="filters">
            <div className="filterTitle">
              <SlidersHorizontal size={17} />
              Filters
            </div>

            <select value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>

            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="relevance">Sort: Relevance</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
              <option value="stock">Availability</option>
            </select>

            <label className="checkFilter">
              <input
                type="checkbox"
                checked={rxOnly}
                onChange={e => setRxOnly(e.target.checked)}
              />
              Prescription required
            </label>

            <span className="resultCount">{visibleMeds.length} products</span>
          </div>

          {pageItems.length ? (
            <>
              <div className="grid">
                {pageItems.map(m => (
                  <ProductCard key={m.id} medicine={m} onAdd={add} />
                ))}
              </div>

              <div className="pagination">
                <button
                  disabled={catalogPage === 1}
                  onClick={() => {
                    setCatalogPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronLeft size={18} /> Previous
                </button>

                <span>
                  Page <strong>{catalogPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  disabled={catalogPage === totalPages}
                  onClick={() => {
                    setCatalogPage(p => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              {q
                ? `No image-backed medicines match "${q}".`
                : 'No customer-facing medicines are available yet.'}
            </div>
          )}
        </main>
      )}

      {page === 'login' && (
        <div className="center">
          {authMode === 'login' ? (
            <form className="panel" onSubmit={login}>
              <HeartPulse size={38} />
              <h2>Welcome back</h2>
              <p>Sign in to manage prescriptions and orders.</p>

              <input
                name="email"
                type="email"
                placeholder="Email address"
                required
              />

              <input
                name="password"
                type="password"
                placeholder="Password"
                required
              />

              <button className="primary wide">Sign in</button>

              <small>
                Demo: customer@pharmaflow.local / password
              </small>

              <div className="authSwitch">
                New to PharmaFlow?
                <button
                  type="button"
                  className="textBtn"
                  onClick={() => {
                    setAuthMode('register');
                    setNotice('');
                  }}
                >
                  Create an account
                </button>
              </div>
            </form>
          ) : (
            <form className="panel" onSubmit={register}>
              <HeartPulse size={38} />
              <h2>Create your account</h2>
              <p>Join PharmaFlow to manage medicines, prescriptions and orders.</p>

              <input
                name="name"
                type="text"
                placeholder="Full name"
                required
              />

              <input
                name="email"
                type="email"
                placeholder="Email address"
                required
              />

              <input
                name="password"
                type="password"
                placeholder="Create password"
                minLength="6"
                required
              />

              <input
                name="confirm"
                type="password"
                placeholder="Confirm password"
                minLength="6"
                required
              />

              <button className="primary wide">Create account</button>

              <div className="authSwitch">
                Already have an account?
                <button
                  type="button"
                  className="textBtn"
                  onClick={() => {
                    setAuthMode('login');
                    setNotice('');
                  }}
                >
                  Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {page === 'rx' && (
        <div className="center">
          <div className="panel widePanel">
            <Upload size={42} />
            <h2>Prescription Center</h2>
            <p>
              Upload a JPG or PNG for OCR-assisted extraction. PDFs are accepted for manual pharmacist review.
            </p>

            {user ? (
              <>
                {prescriptions.length > 0 && (
                  <div className="rxList">
                    <h3>Your prescriptions</h3>
                    {prescriptions.map(p => (
                      <div className="rxCard" key={p.id}>
                        <div>
                          <strong>#{p.id} • {p.file_name}</strong>
                          <small>{new Date(p.created_at).toLocaleString()}</small>
                        </div>
                        <span className={`status ${String(p.status).toLowerCase()}`}>
                          {p.status}
                        </span>
                        <button
                          type="button"
                          className="openRxBtn"
                          onClick={async () => {
                            try {
                              const r = await fetch(`${API}/prescriptions/${p.id}/file`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (!r.ok) throw new Error('Unable to open prescription');
                              const url = URL.createObjectURL(await r.blob());
                              window.open(url, '_blank', 'noopener,noreferrer');
                              setTimeout(() => URL.revokeObjectURL(url), 60000);
                            } catch {
                              setNotice('Unable to open prescription file');
                            }
                          }}
                        >
                          View file
                        </button>
                        {p.ocr_text && (
                          <p className="rxText">{p.ocr_text}</p>
                        )}
                        {String(p.status).toUpperCase() === 'APPROVED' && (
                          <div className="rxApproved">âœ“ Approved prescription can be used at checkout.</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={uploadRx}>
                  <input
                    type="file"
                    name="prescription"
                    accept=".jpg,.jpeg,.png,.pdf"
                    required
                  />
                  <button className="primary wide">Upload & run OCR</button>
                </form>
              </>
            ) : (
              <button className="primary wide" onClick={() => go('login')}>
                Sign in to upload
              </button>
            )}

            <div className="flow">
              <span>01 Upload</span>
              <span>02 OCR</span>
              <span>03 Pharmacist</span>
              <span>04 Approved</span>
            </div>
          </div>
        </div>
      )}

      {page === 'cart' && (
        <div className="content">
          <h2>Your cart</h2>

          {cart.length ? (
            <>
              <div className="cart">
  {cart.map(x => (
    <div className="cartItem" key={x.id}>
      <div className="cartInfo">
        <strong>{x.name}</strong>
        <small>{x.manufacturer || 'Pharmacy product'}</small>
      </div>
      <div className="cartControls">
        <button type="button" onClick={() => changeQty(x.id, -1)}>-</button>
        <span>{x.qty}</span>
        <button type="button" onClick={() => changeQty(x.id, 1)}>+</button>
        <strong>&#8377;{(Number(x.price) * x.qty).toFixed(2)}</strong>
        <button type="button" className="removeBtn" onClick={() => removeFromCart(x.id)}>Remove</button>
      </div>
    </div>
  ))}
</div>

              <div className="summary">
  <label className="addressLabel">Delivery address</label>
  <input
    className="addressInput"
    value={address}
    onChange={e => setAddress(e.target.value)}
    placeholder="Enter delivery address"
    maxLength={255}
    required
  />
                <span>Total</span>
                <strong>&#8377;{total.toFixed(2)}</strong>
                <button
                  className="primary wide"
                  onClick={user ? checkout : () => go('login')}
                >
                  {user ? 'Place order' : 'Sign in to checkout'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty">Your cart is empty.</div>
          )}
        </div>
      )}

      {page === 'orders' && <Orders token={token} />}
      {page === 'admin' && <Admin token={token} setNotice={setNotice} />}
      {page === 'profile' && (
        <div className="content">
          <h2>Account</h2>
          <div className="profile">
            <UserRound size={48} />
            <h3>{user?.name}</h3>
            <p>{user?.email} | {user?.role}</p>
          </div>
        </div>
      )}

      <footer>
        <div>
          <b>PharmaFlow</b>
          <p>Prescription-aware pharmacy workflow with secure staff review.</p>
        </div>
        <div>
          <b>Core workflow</b>
          <p>Catalog | OCR | Pharmacist | Orders | Reminders</p>
        </div>
        <div>
          <b>Engineering</b>
          <p>React | Express | MySQL | FastAPI | Docker</p>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ medicine, onAdd }) {
  const [broken, setBroken] = useState(false);

  if (broken || !medicine.image_url) return null;

  const rx = Number(medicine.prescription_required) === 1;
  const stock = Number(medicine.stock || 0);

  return (
    <article className="product">
      <div className="pic">
        <img
          src={medicine.image_url}
          alt={medicine.name}
          loading="lazy"
          onError={() => setBroken(true)}
        />
        {rx && <span className="rxBadge">Rx</span>}
      </div>

      <div className="pbody">
        <div className="productMeta">
          <span>{medicine.manufacturer || 'Pharmacy'}</span>
          {medicine.category && <span>{medicine.category}</span>}
        </div>

        <h3>{medicine.name}</h3>

        <p className="generic">
          {medicine.generic_name || medicine.description || 'Pharmacy product'}
        </p>

        <div className="stockLine">
          <span className={stock > 0 ? 'inStock' : 'outStock'}>
            {stock > 0 ? 'In stock' : 'Out of stock'}
          </span>
          {rx && <span>Prescription required</span>}
        </div>

        <div className="buy">
          <strong>&#8377;{Number(medicine.price).toFixed(2)}</strong>
          <button disabled={stock <= 0} onClick={() => onAdd(medicine)}>
            {stock > 0 ? 'Add to cart' : 'Unavailable'}
          </button>
        </div>
      </div>
    </article>
  );
}

function Orders({ token }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!token) return;

    fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []));
  }, [token]);

  return (
    <div className="content">
      <div className="sectionHead">
        <div>
          <label>ORDER CENTER</label>
          <h2>Your orders</h2>
        </div>
      </div>

      {data.length ? (
        data.map(o => (
          <div className="order" key={o.id}>
            <div>
              <strong>#{o.id}</strong>
              <span>{new Date(o.created_at).toLocaleString()}</span>
            </div>
            <b>&#8377;{o.total}</b>
            <span className="status">{o.status}</span>
          </div>
        ))
      ) : (
        <div className="empty">
          Sign in and place your first order to see tracking here.
        </div>
      )}
    </div>
  );
}

function Admin({ token, setNotice }) {
  const [data, setData] = useState(null);
  const [rx, setRx] = useState([]);

  async function openPrescription(id) {
    try {
      const r = await fetch(`${API}/prescriptions/${id}/file`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Unable to open prescription');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setNotice(e.message || 'Unable to open prescription');
    }
  }

  useEffect(() => {
    if (!token) return;

    fetch(`${API}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setData);

    fetch(`${API}/prescriptions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setRx(Array.isArray(d) ? d : []));
  }, [token]);

  async function verify(id, status) {
    try {
      const r = await fetch(`${API}/prescriptions/${id}/verify`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          note: `Reviewed by pharmacist on ${new Date().toLocaleString()}`
        })
      });

      const d = await r.json();

      if (!r.ok) {
        setNotice(d.error || `Unable to ${status.toLowerCase()} prescription`);
        return;
      }

      setRx(items =>
        items.map(p => p.id === id ? { ...p, status } : p)
      );

      setNotice(
        status === 'APPROVED'
          ? `Prescription #${id} approved successfully`
          : `Prescription #${id} rejected`
      );
    } catch (err) {
      setNotice('Unable to reach the server while verifying the prescription');
    }
  }

  return (
    <div className="content">
      <label>PHARMACIST CONSOLE</label>
      <h2>Operations dashboard</h2>

      <div className="stats">
        {data && Object.entries(data).map(([k, v]) => (
          <div key={k}>
            <small>{k.replaceAll('_', ' ')}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>

      <h3>Prescription queue</h3>

      {rx.map(p => (
        <div className="rxrow" key={p.id}>
          <div>
            <strong>#{p.id} Ã¢â‚¬Â¢ {p.customer}</strong>
            <p>{p.file_name}</p>`r`n            <button type="button" className="openRxBtn" onClick={() => openPrescription(p.id)}>Open prescription</button>
            <small>{p.ocr_text}</small>
          </div>

          <span>{p.status}</span>

          {['PENDING', 'OCR_REVIEW'].includes(p.status) && (
            <>
              <button onClick={() => verify(p.id, 'APPROVED')}>Approve</button>
              <button onClick={() => verify(p.id, 'REJECTED')}>Reject</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);














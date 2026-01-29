document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is admin
    const isAdmin = localStorage.getItem('isAdmin');
    if (!isAdmin || isAdmin !== 'true') {
        alert('Bu sayfaya erişim yetkiniz yok!');
        window.location.href = 'login.html';
        return;
    }

    // Set admin username
    const username = localStorage.getItem('username') || 'Admin';
    const adminUsernameEl = document.getElementById('adminUsername');
    if (adminUsernameEl) {
        adminUsernameEl.textContent = username;
    }

    // --- MOBILE SIDEBAR LOGIC ---
    const adminSidebar = document.getElementById('adminSidebar');
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const navItems = document.querySelectorAll('.nav-item[data-tab]');

    const toggleSidebar = () => {
        adminSidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = adminSidebar.classList.contains('open') ? 'hidden' : '';
    };

    if (mobileToggle) mobileToggle.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                adminSidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // --- DATA HANDLING (SQL API) ---
    let products = [];

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            products = await res.json();
            loadProducts();
            updateStats();
        } catch (err) {
            console.error('Ürünler yüklenemedi:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            const users = await res.json();
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = users.map(user => `
                    <tr>
                        <td style="font-weight: 600;">${user.username}</td>
                        <td>${user.email}</td>
                        <td>${new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                        <td style="text-align: center;">-</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Kullanıcılar yüklenemedi:', err);
        }
    };

    const updateStats = () => {
        const totalProductsEl = document.getElementById('totalProducts');
        const totalUsersEl = document.getElementById('totalUsers');
        if (totalProductsEl) totalProductsEl.textContent = products.length;
        // Static users for now if DB is empty
        if (totalUsersEl) totalUsersEl.textContent = "3";
    };

    const loadProducts = () => {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#666;">Henüz ürün bulunmuyor</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="${(product.images && product.images[0]) || 'assets/amber-tesbih.png'}" alt="${product.name}" class="product-thumb" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; filter: ${product.filter}; border: 1px solid rgba(212,175,55,0.2);">
                        <span style="font-weight: 600;">${product.name}</span>
                    </div>
                </td>
                <td>${product.category}</td>
                <td style="color: var(--accent-gold); font-weight: 700;">${product.price}</td>
                <td style="font-family: monospace; color: #888;">${product.sku || 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-action" onclick="editProduct(${product.id})" title="Düzenle">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action" onclick="showProductQr(${product.id})" title="QR Kod">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="btn-action" style="color: #f44336; border-color: rgba(244,67,54,0.1);" onclick="deleteProduct(${product.id})" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    // Tab Switching
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.data-section').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');

            if (targetTab === 'products') fetchProducts();
            if (targetTab === 'users') fetchUsers();
        });
    });

    // --- CATEGORY LOGIC ---
    const productCategorySelect = document.getElementById('productCategory');
    const categoriesList = document.getElementById('categoriesList');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const addCategoryBtn = document.getElementById('addCategoryBtn');

    let allCategories = [];

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            allCategories = await res.json();
            renderCategories();
            populateCategoryDropdown();
        } catch (err) {
            console.error('Kategoriler yüklenemedi:', err);
        }
    };

    const renderCategories = () => {
        if (!categoriesList) return;

        if (allCategories.length === 0) {
            categoriesList.innerHTML = '<p style="color: #666; font-style: italic;">Henüz kategori eklenmemiş.</p>';
            return;
        }

        categoriesList.innerHTML = allCategories.map(cat => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--glass-border);">
                <span style="color: #ddd;">${cat.name}</span>
                <button onclick="deleteCategory(${cat.id})" style="background: transparent; border: none; color: #f44336; cursor: pointer; font-size: 0.9rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    };

    const populateCategoryDropdown = () => {
        if (!productCategorySelect) return;

        const currentVal = productCategorySelect.value;

        productCategorySelect.innerHTML = allCategories.length > 0
            ? allCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('')
            : '<option value="" disabled>Kategori bulunamadı</option>';

        // Restore selection if possible, otherwise select first
        if (currentVal && allCategories.some(c => c.name === currentVal)) {
            productCategorySelect.value = currentVal;
        }
    };

    if (addCategoryBtn && newCategoryInput) {
        addCategoryBtn.addEventListener('click', async () => {
            const name = newCategoryInput.value.trim();
            if (!name) return alert('Kategori adı boş olamaz!');

            try {
                addCategoryBtn.disabled = true;
                addCategoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                const res = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });

                if (res.ok) {
                    newCategoryInput.value = '';
                    fetchCategories(); // Reload all
                } else {
                    const data = await res.json();
                    alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
                }
            } catch (err) {
                console.error('Kategori ekleme hatası:', err);
                alert('Sunucu hatası oluştu');
            } finally {
                addCategoryBtn.disabled = false;
                addCategoryBtn.textContent = 'Ekle';
            }
        });
    }

    window.deleteCategory = async (id) => {
        if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchCategories();
            } else {
                alert('Silinemedi!');
            }
        } catch (err) {
            console.error('Silme hatası:', err);
        }
    };

    // --- SETTINGS LOGIC ---
    const togglePriceBtn = document.getElementById('togglePriceVisibility');
    const siteThemeSelect = document.getElementById('siteThemeSelect');

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (togglePriceBtn) {
                togglePriceBtn.checked = data.show_price !== 'false'; // Default to true
            }
            if (siteThemeSelect && data.site_theme) {
                siteThemeSelect.value = data.site_theme;
            }
        } catch (err) {
            console.error('Ayarlar yüklenemedi:', err);
        }
    };

    if (togglePriceBtn) {
        togglePriceBtn.addEventListener('change', async (e) => {
            try {
                const val = e.target.checked ? 'true' : 'false';
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'show_price', value: val })
                });
            } catch (err) {
                console.error('Ayar güncelleme hatası:', err);
                alert('Ayar güncellenemedi!');
                e.target.checked = !e.target.checked;
            }
        });
    }

    if (siteThemeSelect) {
        siteThemeSelect.addEventListener('change', async (e) => {
            try {
                const val = e.target.value;
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'site_theme', value: val })
                });
            } catch (err) {
                console.error('Tema güncelleme hatası:', err);
                alert('Tema güncellenemedi!');
            }
        });
    }

    // --- PRODUCT MODAL LOGIC ---
    const productModal = document.getElementById('productModalOverlay');
    const productForm = document.getElementById('productForm');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitleEl = document.getElementById('modalTitle');

    window.openProductModal = (mode = 'add', product = null) => {
        modalTitleEl.textContent = mode === 'edit' ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle';
        productForm.reset();
        document.getElementById('productId').value = '';

        if (mode === 'edit' && product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productCategory').value = product.category || 'Genel';
            document.getElementById('productDesc').value = product.description || '';
            document.getElementById('productSku').value = product.sku || '';
            document.getElementById('productSerial').value = product.serial || '';
            document.getElementById('productArtist').value = product.artist || '';
            document.getElementById('productMaterial').value = product.material || '';
            document.getElementById('productBeadCount').value = product.bead_count || '';
            document.getElementById('productBeadSize').value = product.bead_size || '';
            document.getElementById('productMotif').value = product.motif || '';
            document.getElementById('productImameSize').value = product.imame_size || '';
            // Handle multiple images (Join array with newlines)
            const images = product.images || [];
            document.getElementById('productImageUrl').value = images.join('\n');

            document.getElementById('productInStock').checked = product.in_stock !== 0;
            document.getElementById('productFeatured').checked = product.featured === 1;
        }

        productModal.classList.add('active');
    };

    const closeProductModal = () => {
        productModal.classList.remove('active');
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeProductModal);

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pId = document.getElementById('productId').value;

        // Parse images from textarea
        const rawImages = document.getElementById('productImageUrl').value;
        const imageArray = rawImages.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);

        if (imageArray.length === 0) {
            imageArray.push("assets/amber-tesbih.png"); // Fallback
        }

        const pData = {
            name: document.getElementById('productName').value,
            price: document.getElementById('productPrice').value,
            category: document.getElementById('productCategory').value,
            desc: document.getElementById('productDesc').value,
            sku: document.getElementById('productSku').value,
            serial: document.getElementById('productSerial').value,
            artist: document.getElementById('productArtist').value,
            material: document.getElementById('productMaterial').value,
            beadCount: document.getElementById('productBeadCount').value,
            beadSize: document.getElementById('productBeadSize').value,
            motif: document.getElementById('productMotif').value,
            imameSize: document.getElementById('productImameSize').value,
            inStock: document.getElementById('productInStock').checked,
            featured: document.getElementById('productFeatured').checked,
            images: imageArray,
            filter: ""
        };

        try {
            const url = pId ? `/api/products/${pId}` : '/api/products';
            const method = pId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pData)
            });

            if (res.ok) {
                alert(pId ? 'Ürün başarıyla güncellendi!' : 'Yeni ürün başarıyla eklendi!');
                closeProductModal();
                fetchProducts();
            } else {
                const errData = await res.json();
                throw new Error(errData.error || 'Sunucu hatası oluştu');
            }
        } catch (err) {
            console.error('Kaydetme hatası:', err);
            alert('Kaydetme hatası: ' + err.message);
        }
    });

    // Global Functions
    window.editProduct = (id) => {
        const product = products.find(p => p.id === id);
        if (product) openProductModal('edit', product);
    };

    window.deleteProduct = async (id) => {
        if (confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
            try {
                const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    alert('Ürün başarıyla silindi!');
                    fetchProducts();
                }
            } catch (err) {
                alert('Hata: ' + err.message);
            }
        }
    };

    // Buttons
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) addProductBtn.addEventListener('click', () => openProductModal('add'));

    // --- QR MODAL LOGIC ---
    const qrModal = document.getElementById('qrModalOverlay');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrContainer = document.getElementById('qrcode');
    const qrProductNameEl = document.getElementById('qrProductName');
    let qrGenerator = null;

    window.showProductQr = (id) => {
        const product = products.find(p => p.id === id);
        if (!product) return;

        qrProductNameEl.textContent = product.name;
        qrContainer.innerHTML = ''; // Clear previous

        // Get full URL for product detail
        const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
        const productUrl = `${baseUrl}urun.html?id=${id}`;

        new QRCode(qrContainer, {
            text: productUrl,
            width: 200,
            height: 200,
            colorDark: "#d4af37",
            colorLight: "#050505",
            correctLevel: QRCode.CorrectLevel.H
        });

        qrModal.classList.add('active');
    };

    const closeQrModal = () => {
        qrModal.classList.remove('active');
    };

    if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', closeQrModal);

    window.printQr = () => {
        const qrCanvas = qrContainer.querySelector('canvas');
        if (!qrCanvas) return;

        const dataUrl = qrCanvas.toDataURL();
        const windowContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Print QR - ${qrProductNameEl.textContent}</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                        img { width: 300px; height: 300px; }
                        h2 { margin-top: 20px; color: #333; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <img src="${dataUrl}" />
                    <h2>${qrProductNameEl.textContent}</h2>
                </body>
            </html>
        `;
        const printWindow = window.open('', '', 'width=600,height=600');
        printWindow.document.open();
        printWindow.document.write(windowContent);
        printWindow.document.close();
    };

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
                localStorage.removeItem('isAdmin');
                window.location.href = 'login.html';
            }
        });
    }

    // --- IMAGE UPLOAD LOGIC ---
    const triggerUploadBtn = document.getElementById('triggerUploadBtn');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const productImageUrlArea = document.getElementById('productImageUrl');

    if (triggerUploadBtn && imageUploadInput) {
        triggerUploadBtn.addEventListener('click', () => {
            imageUploadInput.click();
        });

        imageUploadInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;

            const formData = new FormData();
            for (let i = 0; i < e.target.files.length; i++) {
                formData.append('images', e.target.files[i]);
            }

            // Show loading state
            const originalText = triggerUploadBtn.innerHTML;
            triggerUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
            triggerUploadBtn.disabled = true;

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (res.ok) {
                    // Append new URLs to the textarea
                    const currentVal = productImageUrlArea.value.trim();
                    const newUrls = data.urls.join('\n');

                    productImageUrlArea.value = currentVal ? (currentVal + '\n' + newUrls) : newUrls;

                    alert(`${data.urls.length} fotoğraf başarıyla yüklendi!`);
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                console.error('Yükleme hatası:', err);
                alert('Fotoğraf yüklenirken hata oluştu: ' + err.message);
            } finally {
                // Reset UI
                triggerUploadBtn.innerHTML = originalText;
                triggerUploadBtn.disabled = false;
                imageUploadInput.value = ''; // Reset input to allow selecting same files again
            }
        });
    }

    // --- HERO IMAGES LOGIC ---
    const heroImagesList = document.getElementById('heroImagesList');
    const heroImageInput = document.getElementById('heroImageInput');
    const triggerHeroUploadBtn = document.getElementById('triggerHeroUploadBtn');

    let allHeroImages = [];

    const fetchHeroImages = async () => {
        try {
            const res = await fetch('/api/hero-images');
            allHeroImages = await res.json();
            renderHeroImages();
        } catch (err) {
            console.error('Hero görselleri yüklenemedi:', err);
        }
    };

    const renderHeroImages = () => {
        if (!heroImagesList) return;

        if (allHeroImages.length === 0) {
            heroImagesList.innerHTML = '<p style="color: #666; font-style: italic;">Henüz görsel eklenmemiş.</p>';
            return;
        }

        heroImagesList.innerHTML = allHeroImages.map(img => `
            <div style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid var(--glass-border);">
                <img src="${img.image_url}" alt="${img.title}" style="width: 120px; height: 80px; object-fit: cover; border-radius: 4px;">
                <div style="flex: 1;">
                    <h4 style="color: #fff; margin: 0 0 5px 0; font-size: 0.95rem;">${img.title || 'Başlıksız'}</h4>
                    <p style="color: #888; margin: 0; font-size: 0.8rem;">${img.subtitle || ''}</p>
                </div>
                <button onclick="deleteHeroImage(${img.id})" style="background: transparent; border: none; color: #f44336; cursor: pointer; font-size: 1.1rem; padding: 8px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    };

    if (triggerHeroUploadBtn && heroImageInput) {
        triggerHeroUploadBtn.addEventListener('click', () => {
            heroImageInput.click();
        });

        heroImageInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;

            const formData = new FormData();
            formData.append('images', e.target.files[0]);

            const originalText = triggerHeroUploadBtn.innerHTML;
            triggerHeroUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
            triggerHeroUploadBtn.disabled = true;

            try {
                // First upload the image
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();

                if (uploadRes.ok && uploadData.urls && uploadData.urls[0]) {
                    // Then save to hero_images table
                    const saveRes = await fetch('/api/hero-images', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image_url: uploadData.urls[0],
                            title: 'Ana Sayfa Görseli',
                            subtitle: ''
                        })
                    });

                    if (saveRes.ok) {
                        alert('Görsel başarıyla yüklendi!');
                        fetchHeroImages();
                    } else {
                        throw new Error('Görsel kaydedilemedi');
                    }
                } else {
                    throw new Error(uploadData.error || 'Yükleme hatası');
                }
            } catch (err) {
                console.error('Hero görsel yükleme hatası:', err);
                alert('Görsel yüklenirken hata oluştu: ' + err.message);
            } finally {
                triggerHeroUploadBtn.innerHTML = originalText;
                triggerHeroUploadBtn.disabled = false;
                heroImageInput.value = '';
            }
        });
    }

    window.deleteHeroImage = async (id) => {
        if (!confirm('Bu görseli silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch(`/api/hero-images/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchHeroImages();
            } else {
                alert('Silinemedi!');
            }
        } catch (err) {
            console.error('Silme hatası:', err);
        }
    };

    // Initialize
    fetchProducts();
    fetchSettings();
    fetchCategories();
    fetchHeroImages();
});

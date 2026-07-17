import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getPartnerBrands, getPartnerBranches } from '../services/restaurants.services';
import { getApiError } from '../utils/apiHelpers';

/**
 * Owner: Brand → Branch cascade.
 * Staff with assigned branch: hidden (parent keeps assigned branch).
 */
export default function BrandBranchSelect({
    branchId,
    onBranchChange,
    brandId: controlledBrandId,
    onBrandChange,
    className = '',
    fieldClassName = '',
    selectClassName = '',
    showLabels = true,
    disabled = false,
}) {
    const [brands, setBrands] = useState([]);
    const [branches, setBranches] = useState([]);
    const [brandId, setBrandId] = useState(controlledBrandId || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const bootstrapped = useRef(false);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [brandList, branchList] = await Promise.all([
                    getPartnerBrands(),
                    getPartnerBranches(),
                ]);
                if (!active) return;
                setBrands(brandList);
                setBranches(branchList);

                let nextBrand = controlledBrandId || brandId;
                if (!nextBrand && branchId) {
                    const match = branchList.find((b) => String(b.id) === String(branchId));
                    if (match?.brandId) nextBrand = String(match.brandId);
                }
                if (!nextBrand && brandList[0]) nextBrand = String(brandList[0].id);
                if (nextBrand) {
                    setBrandId(String(nextBrand));
                    onBrandChange?.(String(nextBrand));
                }

                const brandBranches = branchList.filter(
                    (b) => String(b.brandId) === String(nextBrand || '')
                );
                if (branchId && brandBranches.some((b) => String(b.id) === String(branchId))) {
                    // keep existing branch
                } else if (!bootstrapped.current && brandBranches[0]) {
                    onBranchChange?.(String(brandBranches[0].id));
                } else if (!brandBranches.length) {
                    onBranchChange?.('');
                }
                bootstrapped.current = true;
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (controlledBrandId != null && String(controlledBrandId) !== String(brandId)) {
            setBrandId(String(controlledBrandId || ''));
        }
    }, [controlledBrandId, brandId]);

    const brandBranches = useMemo(
        () => branches.filter((b) => String(b.brandId) === String(brandId)),
        [branches, brandId]
    );

    const handleBrandChange = (value) => {
        setBrandId(value);
        onBrandChange?.(value);
        const next = branches.filter((b) => String(b.brandId) === String(value));
        if (next[0]) onBranchChange?.(String(next[0].id));
        else onBranchChange?.('');
    };

    const selectStyle = {
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        color: '#fff',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        minWidth: 140,
    };

    return (
        <div className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
            <label className={fieldClassName} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#999' }}>
                {showLabels && <span>Brand</span>}
                <select
                    className={selectClassName}
                    style={selectClassName ? undefined : selectStyle}
                    value={brandId}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    disabled={disabled || loading}
                >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                </select>
            </label>
            <label className={fieldClassName} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#999' }}>
                {showLabels && <span>Branch</span>}
                <select
                    className={selectClassName}
                    style={selectClassName ? undefined : selectStyle}
                    value={branchId || ''}
                    onChange={(e) => onBranchChange?.(e.target.value)}
                    disabled={disabled || loading || !brandId}
                >
                    <option value="">Select branch</option>
                    {brandBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                </select>
            </label>
            {error && <span style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</span>}
        </div>
    );
}

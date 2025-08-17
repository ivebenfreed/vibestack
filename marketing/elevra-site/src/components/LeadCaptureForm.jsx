import React, { useState } from 'react';

export default function LeadCaptureForm() {
    const [formData, setFormData] = useState({
        email: '',
        company: '',
        pain: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit form');
            }

            setIsSuccess(true);
        } catch (err) {
            setError('Something went wrong. Please try again.');
            console.error('Form submission error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="success-message">
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
                <h3>You're in!</h3>
                <p>We'll email you when early access opens.</p>
                <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--gray)' }}>
                    Expected launch: Q1 2024
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="lead-form">
            <div className="form-group">
                <label htmlFor="email">Work Email</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <label htmlFor="company">Company Name</label>
                <input
                    type="text"
                    id="company"
                    name="company"
                    placeholder="Acme Inc."
                    value={formData.company}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div className="form-group">
                <label htmlFor="pain">What's your biggest database pain? (Optional)</label>
                <input
                    type="text"
                    id="pain"
                    name="pain"
                    placeholder="e.g., Airtable takes forever to load linked records"
                    value={formData.pain}
                    onChange={handleChange}
                />
            </div>
            
            {error && <p className="error-message">{error}</p>}
            
            <button 
                type="submit" 
                className="btn btn-primary submit-button"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Submitting...' : 'Get Early Access →'}
            </button>
        </form>
    );
}
import React from 'react';

interface ShinyTextProps {
    text: string;
    disabled?: boolean;
    speed?: number;
    className?: string;
}

const ShinyText: React.FC<ShinyTextProps> = ({ text, disabled = false, speed = 7, className = '' }) => {
    return (
        <span
            className={`${disabled ? '' : 'shiny-text'} ${className}`}
            style={{
                '--animation-duration': `${speed}s`,
            } as React.CSSProperties & { '--animation-duration': string }}
        >
            {text}
        </span>
    );
};

export default ShinyText; 
import React, { useState, useRef, useEffect } from 'react';
import { School, Search, ChevronDown, Check, X, Edit3, List, PlusCircle } from 'lucide-react';
import { sound } from '../utils/audio';

export const SCHOOL_LIST = [
  'Shiwalik International School, Dehradun',
  "St Jude's School, Dehradun",
  'Scholars Home, Dehradun',
  'Mount Litera Zee School, Roorkee',
  'Mount Litera Zee School, Shimla Bypass',
  'Mount Litera Zee School, Bhaniyawala',
  'Rainbow School, Saharanpur',
  'KLG Public School, Saharanpur',
  "St Mary's Senior Secondary School, Haridwar",
  "St Mary's Academy, Saharanpur",
  'Edify World School, Dehradun',
  'Greenwood Hills School, Dehradun',
  'Will Field School, Dehradun',
  'Sai Grace Academy, Dehradun',
  'Nirmal Ashram Gyan Daan Academy, Rishikesh',
  'Army Public School, Birpur',
  'Bristol School, Dehradun',
  'Guru Nank Mission Public School, Paonta Sahib',
  'Tonsbridge School, Dehradun',
  'Constancia School, Dehradun',
  'Public Inter College',
  'Brooklyn School',
  'Doon International School, Dehradun',
  'The Asian School, Dehradun',
  'Pinewood School, Saharanpur',
  'The Arcadia School, Dehradun',
  'Graphic Era Global School, Dehradun',
  "St. Joseph's Academy, Dehradun",
  'Army Public School, Clement Town',
  'Jaswant Modern Sr Sec School, Dehradun',
  'Stone Ridge International School, Rudrapur',
  'SGRR',
  'SGRR, Vasant Vihar',
  'SGRR, Talab',
  'The Heritage School, Dehradun',
  'Olympus High School, Dehradun',
  'Roorkee Public School, Roorkee',
];

export default function SchoolSearchDropdown({
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  touched,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const manualInputRef = useRef(null);

  // Filtered schools based on search query
  const filteredSchools = SCHOOL_LIST.filter((school) =>
    school.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && !isManualMode) {
      setHighlightIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isManualMode]);

  // Focus manual input when manual mode is activated
  useEffect(() => {
    if (isManualMode) {
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 50);
    }
  }, [isManualMode]);

  const handleSelect = (school) => {
    sound.playPop();
    onChange(school);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    sound.playPop();
    onChange('');
    setSearchTerm('');
  };

  const switchToManual = () => {
    sound.playPop();
    setIsManualMode(true);
    setIsOpen(false);
    if (searchTerm.trim() && !value) {
      onChange(searchTerm.trim());
    }
  };

  const switchToList = () => {
    sound.playPop();
    setIsManualMode(false);
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (isManualMode) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filteredSchools.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSchools.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && filteredSchools[highlightIndex]) {
        handleSelect(filteredSchools[highlightIndex]);
      } else if (searchTerm.trim()) {
        handleSelect(searchTerm.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`school-combobox-wrapper ${isOpen ? 'dropdown-open' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Top toggle link for quick manual switch */}
      <div className="school-mode-header-strip">
        {isManualMode ? (
          <button
            type="button"
            onClick={switchToList}
            className="school-toggle-mode-btn"
          >
            <List size={13} />
            <span>← Choose from Predefined List</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={switchToManual}
            className="school-toggle-mode-btn"
          >
            <Edit3 size={13} />
            <span>School not in list? Enter manually</span>
          </button>
        )}
      </div>

      {isManualMode ? (
        /* MANUAL TEXT INPUT MODE */
        <div className="input-wrap manual-school-input-wrap">
          <School size={18} className="field-icon" />
          <input
            ref={manualInputRef}
            type="text"
            id="schoolName"
            name="schoolName"
            placeholder="Type your complete school name & city..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className="manual-input"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="clear-school-btn"
              title="Clear input"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        /* SEARCHABLE DROPDOWN MODE */
        <>
          <div
            className={`input-wrap school-trigger-box ${isOpen ? 'active-trigger' : ''}`}
            onClick={() => {
              setIsOpen((prev) => !prev);
              onFocus?.();
            }}
          >
            <School size={18} className="field-icon" />

            <div className="school-display-value">
              {value ? (
                <span className="selected-school-text">{value}</span>
              ) : (
                <span className="placeholder-text">Click to select or search school...</span>
              )}
            </div>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="clear-school-btn"
                title="Clear selection"
              >
                <X size={15} />
              </button>
            )}

            <ChevronDown
              size={18}
              className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}
            />
          </div>

          {/* Solid Opaque Dropdown Menu (Guaranteed Visible on Top) */}
          {isOpen && (
            <div className="school-dropdown-menu">
              {/* Search Header */}
              <div className="dropdown-search-box">
                <Search size={16} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type school name or city to filter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="school-search-input"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="search-clear-btn"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Quick Manual Entry Option Bar */}
              <div
                className="dropdown-manual-entry-banner"
                onClick={switchToManual}
              >
                <Edit3 size={15} className="banner-icon" />
                <div className="banner-text">
                  <span>School not found in the list?</span>
                  <strong>Click here to enter manually</strong>
                </div>
              </div>

              {/* School Count Header */}
              <div className="dropdown-meta-strip">
                <span>
                  {filteredSchools.length} {filteredSchools.length === 1 ? 'school' : 'schools'} available
                </span>
                {searchTerm && (
                  <span className="search-filter-tag">Filtered</span>
                )}
              </div>

              {/* List Options */}
              <div className="school-options-list">
                {filteredSchools.length > 0 ? (
                  filteredSchools.map((school, index) => {
                    const isSelected = value === school;
                    const isHighlighted = highlightIndex === index;

                    return (
                      <div
                        key={school}
                        onClick={() => handleSelect(school)}
                        onMouseEnter={() => setHighlightIndex(index)}
                        className={`school-option-item ${isSelected ? 'selected' : ''} ${
                          isHighlighted ? 'highlighted' : ''
                        }`}
                      >
                        <div className="school-item-content">
                          <School size={16} className="school-item-icon" />
                          <span className="school-item-name">{school}</span>
                        </div>

                        {isSelected && (
                          <Check size={16} className="selected-check-icon" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="no-schools-found">
                    <p className="no-match-alert">
                      No matching school found for "<strong>{searchTerm}</strong>"
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelect(searchTerm.trim())}
                      className="custom-school-btn"
                    >
                      <PlusCircle size={15} />
                      <span>Use "{searchTerm.trim()}" as School Name</span>
                    </button>
                    <button
                      type="button"
                      onClick={switchToManual}
                      className="manual-type-btn-alt"
                    >
                      <Edit3 size={14} />
                      <span>Switch to Manual Input Mode</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

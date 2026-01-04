// Alert Modal Utility
// Reusable modal for displaying alerts/notifications

/**
 * Show an alert modal with a message
 * @param {string} message - The message to display
 * @param {string} type - The type of alert: 'success', 'error', 'info', 'warning' (default: 'info')
 */
function showAlertModal(message, type = 'info') {
    // Get or create the alert modal element
    let modalElement = document.getElementById('alertModal');
    
    if (!modalElement) {
        // Create the modal HTML structure
        modalElement = document.createElement('div');
        modalElement.id = 'alertModal';
        modalElement.className = 'modal fade';
        modalElement.setAttribute('tabindex', '-1');
        modalElement.setAttribute('aria-labelledby', 'alertModalLabel');
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="alertModalLabel"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="alertModalMessage"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalElement);
    }
    
    // Set the modal content
    const modalTitle = modalElement.querySelector('#alertModalLabel');
    const modalMessage = modalElement.querySelector('#alertModalMessage');
    const modalHeader = modalElement.querySelector('.modal-header');
    const okButton = modalElement.querySelector('.modal-footer .btn');
    
    // Clear previous classes
    modalHeader.classList.remove('bg-success', 'bg-danger', 'bg-info', 'bg-warning', 'text-white');
    okButton.classList.remove('btn-success', 'btn-danger', 'btn-info', 'btn-warning');
    
    // Set content and styling based on type
    modalMessage.textContent = message;
    
    switch (type.toLowerCase()) {
        case 'success':
            modalTitle.textContent = 'Success';
            modalHeader.classList.add('bg-success', 'text-white');
            okButton.classList.add('btn-success');
            break;
        case 'error':
            modalTitle.textContent = 'Error';
            modalHeader.classList.add('bg-danger', 'text-white');
            okButton.classList.add('btn-danger');
            break;
        case 'warning':
            modalTitle.textContent = 'Warning';
            modalHeader.classList.add('bg-warning', 'text-white');
            okButton.classList.add('btn-warning');
            break;
        default:
            modalTitle.textContent = 'Information';
            modalHeader.classList.add('bg-info', 'text-white');
            okButton.classList.add('btn-info');
    }
    
    // Show the modal using Bootstrap
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// Make it globally accessible
window.showAlertModal = showAlertModal;

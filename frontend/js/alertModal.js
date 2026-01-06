

function showAlertModal(message, type = 'info') {
    
    let modalElement = document.getElementById('alertModal');
    
    if (!modalElement) {
        
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

    const modalTitle = modalElement.querySelector('#alertModalLabel');
    const modalMessage = modalElement.querySelector('#alertModalMessage');
    const modalHeader = modalElement.querySelector('.modal-header');
    const okButton = modalElement.querySelector('.modal-footer .btn');

    modalHeader.classList.remove('bg-success', 'bg-danger', 'bg-info', 'bg-warning', 'text-white');
    okButton.classList.remove('btn-success', 'btn-danger', 'btn-info', 'btn-warning');
    modalHeader.style.backgroundColor = '';
    modalHeader.style.color = '';

    modalMessage.textContent = message;
    
    switch (type.toLowerCase()) {
        case 'success':
            modalTitle.textContent = 'Success';
            modalHeader.style.backgroundColor = '#1C4D8D';
            modalHeader.style.color = 'white';
            okButton.classList.add('btn-primary');
            break;
        case 'error':
            modalTitle.textContent = 'Error';
            modalHeader.style.backgroundColor = '#dc3545';
            modalHeader.style.color = 'white';
            okButton.classList.add('btn-danger');
            break;
        case 'warning':
            modalTitle.textContent = 'Warning';
            modalHeader.style.backgroundColor = '#BDE8F5';
            modalHeader.style.color = '#333';
            okButton.classList.add('btn-secondary');
            break;
        default:
            modalTitle.textContent = 'Information';
            modalHeader.style.backgroundColor = '#0dcaf0';
            modalHeader.style.color = 'white';
            okButton.classList.add('btn-info');
    }

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

window.showAlertModal = showAlertModal;
